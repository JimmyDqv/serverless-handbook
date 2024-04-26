# SQS + Lambda - Retry with Jitter

## Intro

In this solution we have an Lambda function that process work from a SQS queue. In case of a failure messages are added to a Retry Queue (DLQ).
A retry handling Lambda will detect failures and send it back to the queue but with a DelaySeconds value, a time the message will be invisible, the backoff + jitter time.

The envelope pattern, metadata - data, is added to the original payload, so our worker must be able to handle payload both with and without the envelope.
We do this to keep track of number of retries, and when to give up.

``` json
{
    "metadata": {
        "retryCount" : 1
    },
    "data": {}
}
```

![SQS Lambda pattern](images/sqs-lambda.png)
