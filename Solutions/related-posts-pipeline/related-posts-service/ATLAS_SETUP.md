# MongoDB Atlas Setup — related-posts-service

One-time setup for the MongoDB Atlas M0 free-tier cluster that backs the related-posts pipeline. Follow these steps in order. Some require the SAM stack to be deployed first; the order section calls that out.

## Order at a glance

Three deploys, three out-of-band Atlas configurations, no chicken-and-egg. The federated Atlas IAM role is created in its own tiny stack (`related-posts-atlas-roles`); Lambdas in `related-posts-service` only `sts:AssumeRole` into it, so re-deploying the Lambdas never touches Atlas.

1. Create the Atlas account / project (Atlas UI, one-time per account).
2. Create the M0 cluster (`related-posts-cluster`).
3. Create the database and collection (`blog.posts`).
4. **Open the Network Access List for Lambda egress** (`0.0.0.0/0`). Atlas blocks connections at the TLS layer until this is set — symptom is `TLSV1_ALERT_INTERNAL_ERROR`. Auth is still enforced by MONGODB-AWS; this only opens the network.
5. Build the connection string (no password — IAM auth).
6. Deploy/redeploy `related-posts-common` (provisions the Atlas secret via CFN with a `REPLACE_ME` placeholder), then fill in the real SRV URI via the Secrets Manager console.
7. Deploy `related-posts-atlas-roles` (creates the `BlogPipelineAtlasRWRole`). Capture the role ARN.
8. **Federate the single role ARN in Atlas** as an AWS IAM database user with `readWrite` on `blog.posts`. One-time. Never repeated as Lambdas redeploy.
9. Create the `posts_vector_idx` Vector Search index.
10. `sam deploy` the `related-posts-service` stack. Its three Lambdas import the role ARN and assume it at runtime.
11. Smoke-test the connection from the orchestrator Lambda.

Steps 1–10 happen before relying on the orchestrator end-to-end. Step 11 confirms the wiring.

> **Note on initial hydration:** the very first time this stack went live, the Atlas index was empty and the agent had no candidates to retrieve. A one-off backfill script enumerated every published post in `cms_content.blog_posts`, ran the orchestrator's embed pipeline (`compute_hash → parse_frontmatter → embed_text → upsert_post`) against each, and wrote one Atlas document per post. The corpus is now hydrated; the orchestrator's `PostPublished` flow keeps it current. If a fresh environment ever needs the same hydration (e.g., new Atlas project, full collection wipe), recover the script from git history (`git log --all -- datastore/atlas/backfill-embeddings.py`).

---

## 1. Atlas account + project

1. Sign up / log in at <https://cloud.mongodb.com/>.
2. Create (or reuse) a project named `related-posts`. Capture the **Project ID** — it appears in the URL as `/v2/<PROJECT_ID>#/clusters`.
3. Install the Atlas CLI if you want to script anything below:

   ```bash
   brew install mongodb-atlas-cli
   atlas auth login
   atlas config set project_id <PROJECT_ID>
   ```

## 2. Create the M0 cluster

**UI path:** *Atlas → Database → Build a Database → M0 Free → AWS → eu-west-1 → Cluster Name `related-posts-cluster` → Create*.

**Atlas CLI alternative:**

```bash
atlas clusters create related-posts-cluster \
  --provider AWS \
  --region EU_WEST_1 \
  --tier M0 \
  --tag Application=related-posts
```

Wait until the cluster shows status `IDLE` (~5 minutes).

## 3. Create the database and collection

**UI path:** *Browse Collections → Create Database*

- Database name: `blog`
- Collection name: `posts`

Atlas requires at least one collection to materialise the database; the M0 free tier creates them lazily on first insert too, but creating them explicitly now means the index creation in step 9 has somewhere to attach.

## 4. Configure the Network Access List

**The single most common cause of `TLSV1_ALERT_INTERNAL_ERROR` from Atlas.** This step is independent of IAM federation — the network-layer allowlist is checked before any credential exchange happens. Atlas defaults to deny-all, so an unallowlisted source IP triggers a server-side TLS alert that pymongo surfaces as:

```text
SSL handshake failed: <host>:27017: [SSL: TLSV1_ALERT_INTERNAL_ERROR] tlsv1 alert internal error
```

The Lambdas here are **not in a VPC** (deliberate, v1) so their egress IPs are drawn from AWS's shared NAT pool and have no fixed CIDR you can narrow to. For an M0 cluster the practical option is to allow access from anywhere — credentials are still enforced by `MONGODB-AWS` (the IAM-signed handshake), so anyone connecting still has to present valid STS-signed AWS credentials that map to a federated database user.

**UI path:** *Atlas → Security → Network Access → Add IP Address → ALLOW ACCESS FROM ANYWHERE → Confirm*. Entry shows as `0.0.0.0/0` with status `Active` after ~30 seconds.

**Atlas CLI alternative:**

```bash
atlas accessLists create --type ipAddress --ip 0.0.0.0/0 --comment "Lambda egress (no VPC)"
```

**Future hardening** (out of scope for v1, all incompatible with M0):

- Move Lambdas into a VPC with a NAT Gateway + Elastic IP, then narrow the allowlist to that EIP.
- Use Atlas PrivateLink (requires M10+) for a private network path with no public exposure.
- Restrict to AWS-side IP ranges via the `ip-ranges.json` egress block for your region.

## 5. Build the connection string

Atlas → cluster → **Connect** → **Drivers** → choose **Python** + version 4.x. Atlas shows an SRV URI like:

```
mongodb+srv://<cluster-host>/?retryWrites=true&w=majority&appName=Cluster0
```

We use it as a **template** — the orchestrator and tool Lambdas authenticate via AWS IAM (MONGODB-AWS), not a password. The template we store is:

```
mongodb+srv://<cluster-host>/?authSource=%24external&authMechanism=MONGODB-AWS&retryWrites=true&w=majority
```

```
mongodb+srv://related-posts-cluster.abc123.mongodb.net/?appName=related-posts-cluster&authSource=%24external&authMechanism=MONGODB-AWS&retryWrites=true&w=majority
```

Replace `<cluster-host>` with the real cluster hostname (e.g. `related-posts-cluster.abc123.mongodb.net`). Save it for the next step. **No password is included** — credentials come from the Lambda's IAM role at runtime.

## 6. Deploy/redeploy `related-posts-common` and fill in the secret value

**Secrets in this repo are declared in CloudFormation, never created via `aws secretsmanager create-secret`.** The Atlas connection secret lives in [`blog-pipeline/common/template.yaml`](../common/template.yaml) alongside the GitHub token secret. It is provisioned with a `REPLACE_ME` placeholder; you fill in the real SRV URI via the Secrets Manager console after deploy.

Deploy (or redeploy if the common stack already exists):

```bash
cd blog-pipeline/common
sam build
sam deploy
```

The common stack now exports `AtlasConnectionSecretArn`. Capture its value:

```bash
aws cloudformation describe-stacks \
  --stack-name related-posts-common \
  --query "Stacks[0].Outputs[?OutputKey=='AtlasConnectionSecretArn'].OutputValue" \
  --output text \
  --region eu-west-1
```

Now fill in the real value. Open the secret in the AWS Secrets Manager console (or via CLI `aws secretsmanager update-secret`):

- **Console path:** *Secrets Manager → `related-posts/atlas-connection` → Retrieve secret value → Edit → Plaintext*. Replace the JSON body with:

  ```json
  {
    "srvUri": "mongodb+srv://<cluster-host>/?authSource=%24external&authMechanism=MONGODB-AWS&retryWrites=true&w=majority",
    "db": "blog",
    "collection": "posts"
  }
  ```

  Substitute the real cluster host from step 5. Save.

- **CLI alternative** (one-shot update, value lives in shell history):

  ```bash
  SRV_URI='mongodb+srv://<cluster-host>/?authSource=%24external&authMechanism=MONGODB-AWS&retryWrites=true&w=majority'
  aws secretsmanager update-secret \
    --secret-id related-posts/atlas-connection \
    --secret-string "{\"srvUri\":\"${SRV_URI}\",\"db\":\"blog\",\"collection\":\"posts\"}" \
    --region eu-west-1
  ```

Verify the new value is in place:

```bash
aws secretsmanager get-secret-value \
  --secret-id related-posts/atlas-connection \
  --query SecretString --output text \
  --region eu-west-1
```

## 7. Deploy the `related-posts-atlas-roles` stack

This stack creates a single IAM role (`BlogPipelineAtlasRWRole`) that becomes the **sole** Atlas-federated principal. Lambdas in `related-posts-service` assume this role at runtime to authenticate Atlas connections.

```bash
cd blog-pipeline/atlas-roles
sam build
sam deploy
```

The stack output `BlogPipelineAtlasRWRoleArn` is what you'll federate with Atlas in the next step. Capture it:

```bash
aws cloudformation describe-stacks \
  --stack-name related-posts-atlas-roles \
  --query "Stacks[0].Outputs[?OutputKey=='BlogPipelineAtlasRWRoleArn'].OutputValue" \
  --output text \
  --region eu-west-1
```

The role name follows the pattern `related-posts-blog-pipeline-atlas-rw`.

## 8. Federate the role with Atlas (one-time)

**One role to federate, never repeated as Lambdas redeploy.** Use the ARN from step 7.

**UI path:** *Atlas → Database Access → Add New Database User → Authentication Method: AWS IAM → AWS IAM Type: IAM Role → IAM Role ARN: paste the ARN from step 7 → Built-in Role: `readWrite@blog` → Add User*.

**Atlas CLI alternative:**

```bash
ATLAS_ROLE_ARN=$(aws cloudformation describe-stacks \
  --stack-name related-posts-atlas-roles \
  --query "Stacks[0].Outputs[?OutputKey=='BlogPipelineAtlasRWRoleArn'].OutputValue" \
  --output text --region eu-west-1)

atlas dbusers create readWrite \
  --username "$ATLAS_ROLE_ARN" \
  --awsIAMType ROLE \
  --scope related-posts-cluster,CLUSTER
```

To scope tighter to the single collection, replace the `readWrite` built-in role with a custom Atlas role granting `readWrite` only on `blog.posts`. The built-in is fine for v1.

Atlas may take ~30 seconds to propagate the new IAM database user after creation.

## 9. Create the Vector Search index `posts_vector_idx`

The index must be on `blog.posts` and named `posts_vector_idx`. Schema:

```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 1024, "similarity": "cosine" },
    { "type": "filter", "path": "language" },
    { "type": "filter", "path": "tags" },
    { "type": "filter", "path": "category" }
  ]
}
```

`slug` is deliberately not a filter field — it's used only for post-stage `$nin` exclusion, which doesn't need indexing.

**UI path:** *Atlas → cluster → Atlas Search → Create Search Index → Vector Search → JSON Editor → paste the JSON above → Index Name `posts_vector_idx` → Database `blog` → Collection `posts` → Next → Create*.

**Atlas CLI alternative:**

```bash
cat > /tmp/vector-index.json <<'EOF'
{
  "name": "posts_vector_idx",
  "database": "blog",
  "collectionName": "posts",
  "type": "vectorSearch",
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 1024, "similarity": "cosine" },
    { "type": "filter", "path": "language" },
    { "type": "filter", "path": "tags" },
    { "type": "filter", "path": "category" }
  ]
}
EOF

atlas clusters search indexes create \
  --clusterName related-posts-cluster \
  --file /tmp/vector-index.json
```

Index build takes ~1 minute on an empty collection. Status reaches `READY` when it can serve queries.

## 10. Deploy the `related-posts-service` stack

All prerequisites are in place: Network Access List configured (step 4), secret has its real value (step 6), Atlas role exists and is federated (steps 7–8), Vector Search index is ready (step 9). The Lambdas only need to be deployed once and will immediately be able to talk to Atlas via the role they assume.

No samconfig edits needed — the template imports the secret ARN, the Atlas role ARN, the EventBridge bus, and the DSQL endpoint via `Fn::ImportValue`. The only parameters are the three stack names that hold those exports, and they default sensibly:

```yaml
parameter_overrides:
  - Application=related-posts
  - CommonStackName=related-posts-common
  - DataStoreStackName=related-posts-statistics-data-store-dsql
```

(`AtlasRolesStackName` defaults to `related-posts-atlas-roles` in the template, so it doesn't need to be in samconfig.)

Deploy:

```bash
cd blog-pipeline/related-posts-service
sam build
sam deploy
```

Subsequent re-deploys of this stack do **not** require any Atlas action. The federated role is decoupled from the Lambda execution roles.

## 11. Smoke-test the connection

Publish a `PostPublished` event for a real existing post and tail the orchestrator log group:

```bash
# Replace <slug> with a post that exists at posts/<slug>.md in the blog repo
# Replace <commit-sha> with HEAD of main on the blog repo
aws events put-events --region eu-west-1 --entries '[
  {
    "Source": "blog.cms",
    "DetailType": "PostPublished",
    "EventBusName": "related-posts-events",
    "Detail": "{\"slug\":\"serverless-event-platform\",\"language\":\"en\",\"branch\":\"main\",\"commit_sha\":\"8c0900b65d91ac15d8d8985aeff165e2081e3fca\"}"
  }
]'
```

Find the orchestrator log group:

```bash
aws logs describe-log-groups \
  --log-group-name-prefix '/aws/lambda/related-posts-service-RelatedPostsOrchestrator' \
  --query 'logGroups[0].logGroupName' --output text \
  --region eu-west-1
```

Tail it:

```bash
aws logs tail \
  /aws/lambda/related-posts-service-RelatedPostsOrchestrator-<random> \
  --follow --since 5m \
  --region eu-west-1
```

Expected sequence: `fetch_source` → `find_by_id` → `embed_post` → `upsert_post` → `agent_pick_primary` → `find_backlink_candidates` → (parallel `recompute_backlink:*` if neighbors exist) → `persist_primary_dsql` → `invoke_commit_pr`. A new PR should appear on the blog repo titled `chore(related-posts): refresh for <slug>`.

## Common failures and how to read them

| Symptom in CloudWatch | Likely cause | Fix |
|---|---|---|
| `TLSV1_ALERT_INTERNAL_ERROR` / `SSL handshake failed` during MongoClient connect | Atlas Network Access List denies the Lambda's egress IP at the TLS layer (independent of IAM federation) | Complete step 4 — add `0.0.0.0/0` to the Atlas Network Access List |
| `bad auth : aws sts call has response 403` | Atlas POSTed the SigV4-signed `GetCallerIdentity` to AWS STS and got back HTTP 403. Almost always either (a) `AWS_STS_REGIONAL_ENDPOINTS=regional` mismatch between pymongo's signed endpoint and Atlas's expected endpoint, or (b) federated ARN mismatch in Atlas | The template now sets `AWS_STS_REGIONAL_ENDPOINTS: legacy` on the three Atlas-using Lambdas, forcing the global STS endpoint. If 403 persists, run the `aws sts assume-role` verification in step 4 of the pre-redeploy checklist and compare to the ARN in Atlas Database Access |
| `ResourceNotFoundException: Model use case details have not been submitted` from Bedrock `Converse` | Anthropic-on-Bedrock requires a one-time per-account Use Case Details form, separate from model access | Bedrock console (`eu-west-1`) → Model access → Anthropic Claude Sonnet 4.6 → "Submit use case details" → fill the form → wait ~2 min |
| `Authentication failed.` from pymongo | Atlas IAM federation missing for that role ARN | Re-do step 8 for the missing role |
| `Cannot find collection 'blog.posts'` | Database/collection not created | Re-do step 3 |
| `Index 'posts_vector_idx' not found` | Vector index missing or not yet READY | Re-do step 9, wait for status READY |
| `Required field 'embedding' missing from tool input` | Agent called the tool with a malformed payload | Inspect agent's `_build_agent` output; usually a model regression |
| `Agent returned <N> picks, need exactly 3` | Sonnet returned non-JSON or wrong count | Inspect `_extract_text` output in the same execution |
| `InvalidSignatureException` from Gateway | SigV4 signing scope mismatch on `bedrock-agentcore` | Verify `aws_service` constant in `agent.py` matches what AgentCore expects |
| `KeyError: 'AGENTCORE_GATEWAY_URL'` | Gateway resource didn't deploy, env var unresolved | Confirm CFN stack outputs include the gateway and the env var is set |

## Pre-redeploy verification checklist

Five-minute sanity sweep before each `sam deploy` of `related-posts-service`. If any item fails, complete the corresponding setup step before redeploying — saves a deploy-then-fail cycle.

**1. GitHub token secret has a real value (not `REPLACE_ME`).**

```bash
aws secretsmanager get-secret-value \
  --secret-id related-posts/github \
  --query SecretString --output text \
  --region eu-west-1
```

Expect a JSON with a real `ghp_…` PAT. If it says `REPLACE_ME`, fill it in via the Secrets Manager console.

**2. Atlas connection secret has a real SRV URI (not `REPLACE_ME`).**

```bash
aws secretsmanager get-secret-value \
  --secret-id related-posts/atlas-connection \
  --query SecretString --output text \
  --region eu-west-1
```

Expect `srvUri` containing your real cluster host (e.g. `related-posts-cluster.abc123.mongodb.net`). If `REPLACE_ME`, complete step 6.

**3. Atlas Network Access List contains `0.0.0.0/0` (or your custom CIDR).**

Atlas UI → Security → Network Access. Expect an entry with status `Active`. If not present, complete step 4 — this is the most common cause of `TLSV1_ALERT_INTERNAL_ERROR`.

**4. Atlas Database Access lists `BlogPipelineAtlasRWRole` as an AWS IAM user — byte-for-byte ARN match.**

Atlas UI → Database Access. Expect a user with:

- Authentication Method: AWS IAM
- Username: `arn:aws:iam::<account>:role/related-posts-blog-pipeline-atlas-rw`
- Role: `readWrite@blog`

Confirm the ARN matches what the Lambda will actually present to Atlas. The Lambda calls `sts.assume_role` and the resulting credentials carry an assumed-role principal of the form `arn:aws:sts::<account>:assumed-role/related-posts-blog-pipeline-atlas-rw/related-posts-atlas`; Atlas's "IAM Role" type resolves the base role ARN to any session of that role, so federating the base role ARN is correct. But a typo, wrong account, or stray path segment in the federated ARN will produce `bad auth : aws sts call has response 403` at runtime.

To reproduce locally the EXACT ARN Atlas will see, run:

```bash
ATLAS_ROLE_ARN=$(aws cloudformation describe-stacks \
  --stack-name related-posts-atlas-roles \
  --query "Stacks[0].Outputs[?OutputKey=='BlogPipelineAtlasRWRoleArn'].OutputValue" \
  --output text --region eu-west-1)

aws sts assume-role \
  --role-arn "$ATLAS_ROLE_ARN" \
  --role-session-name "verification" \
  --region eu-west-1 \
  --query 'AssumedRoleUser.Arn' --output text
```

The printed `arn:aws:sts::...:assumed-role/.../verification` shows the principal shape Atlas will receive. Compare the role-name segment byte-for-byte against the federated user in Atlas UI. After deploy, the orchestrator now also logs the same identity (look for `assumed Atlas role identity:` in CloudWatch) for a runtime confirmation.

If missing or mismatched, complete step 8 (re-federate with the correct ARN).

**5. Vector Search index `posts_vector_idx` exists and status is READY.**

Atlas UI → Search → Search Indexes. Expect `posts_vector_idx` on `blog.posts` with status `READY` (not `BUILDING`). If missing or still building, complete step 9 and wait.

**6. Bedrock cross-region inference profile `eu.anthropic.claude-sonnet-4-6` is enabled in `eu-west-1` AND the Anthropic Use Case form is submitted.**

Two separate checks for the agent step to work — both required:

- **Model access**: Bedrock console (`eu-west-1`) → Model access → Anthropic Claude Sonnet 4.6 → status `Access granted`. If `Available to request`, click Request access.
- **Use Case Details form**: Anthropic-on-Bedrock additionally requires a one-time per-account form describing your intended use of Claude. Without it the runtime error is:

  ```text
  ResourceNotFoundException: Model use case details have not been submitted
  for this account. Fill out the Anthropic use case details form before
  using the model.
  ```

  Fix: Bedrock console → Model access → click Anthropic Claude Sonnet 4.6 → "Submit use case details" banner → fill in the company/intended-use/PII questions → Submit. AWS says wait 15 min; usually <2 min before the model accepts traffic.

Without both of these, the durable step `agent_pick_primary` will fail at the Bedrock `Converse` call.

If items 1–6 all pass, you're safe to `sam build && sam deploy`.

## Atlas costs to expect on M0

- Storage: 0 (free tier limit is 0.5 GB, plenty for the corpus size).
- Vector Search: 0 on M0 (included).
- Egress: ~free for low-volume agent calls.
- The whole pipeline runs on the AWS free tier + Atlas free tier — that's the headline of the companion blog post at [docs/blog-outlines/related-posts.md](../../docs/blog-outlines/related-posts.md).

When you outgrow M0 (corpus approaches the 0.5 GB cap or sustained agent execution rate exceeds ~10/minute), promote the cluster to Flex or M10 via *Cluster → Edit Configuration → Tier*. The connection string and IAM users carry over; no code change needed.
