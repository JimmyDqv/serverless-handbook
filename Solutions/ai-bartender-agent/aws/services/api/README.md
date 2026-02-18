# AI Bartender API

REST API Gateway with Lambda functions for the AI Bartender application.

## Overview

- **API Gateway** with custom domain, CORS, rate limiting, and API key authentication
- **28 Lambda functions** for drinks, orders, sections, registration, and admin operations
- **3 authorizers**: Cognito JWT (admin), custom JWT (users), registration code validator
- **Aurora DSQL** database with IAM authentication via STS AssumeRole
- **AppSync Events** integration for real-time order updates

## API Endpoints

### Public (API key only, no auth)

| Method | Path                              | Description                            |
| ------ | --------------------------------- | -------------------------------------- |
| GET    | /sections                         | List drink sections                    |
| GET    | /drinks                           | List drinks with optional filtering    |
| GET    | /drinks/{id}                      | Get drink details                      |

### User (custom JWT auth)

| Method | Path                              | Description                            |
| ------ | --------------------------------- | -------------------------------------- |
| POST   | /orders                           | Create a new order                     |
| GET    | /orders                           | List user's orders                     |
| GET    | /orders/{id}                      | Get order status                       |
| POST   | /register                         | Register with a registration code      |
| POST   | /auth/refresh                     | Refresh access token                   |

### Admin (Cognito JWT auth)

| Method | Path                              | Description                             |
| ------ | --------------------------------- | --------------------------------------- |
| GET    | /admin/drinks                     | List all drinks (including inactive)    |
| POST   | /admin/drinks                     | Create a drink                          |
| PUT    | /admin/drinks/{id}                | Update a drink                          |
| DELETE | /admin/drinks/{id}                | Delete a drink and its images           |
| GET    | /admin/sections                   | List all sections                       |
| POST   | /admin/sections                   | Create a section                        |
| PUT    | /admin/sections/{id}              | Update a section                        |
| DELETE | /admin/sections/{id}              | Delete a section                        |
| GET    | /admin/orders                     | Get all orders (admin queue)            |
| PUT    | /admin/orders/{id}                | Update order status                     |
| GET    | /admin/registration-codes         | List registration codes                 |
| POST   | /admin/registration-codes         | Create a registration code              |
| DELETE | /admin/registration-codes/{code}  | Delete a registration code              |
| POST   | /admin/images/upload-url          | Generate presigned URL for image upload |

## Deployment

### Prerequisites

1. Infrastructure stacks deployed: `datastore`, `auth`, `hosting`, `eventbridge`, `appsync`
2. Database schema applied (see `database/README.md`)
3. SAM CLI and AWS CLI configured

### Deploy

```bash
sam build && sam deploy
```

### Post-Deployment: JWT Keys Setup

After the first deployment, generate the RSA key pair used for user JWT signing:

```bash
python3 setup-jwt-keys.py --profile <your-profile>
```

This is a **one-time** step. The script generates an RSA key pair and stores it in the `JWTKeysSecret` created by the template. User registration will not work without this.

Run it again only if you need to rotate keys.

## Project Structure

```
src/
├── authorizer/              # Cognito JWT authorizer (admin)
├── userAuthorizer/          # Custom JWT authorizer (users)
├── registrationAuthorizer/  # Registration code validator
├── getSections/             # GET /sections
├── getDrinks/               # GET /drinks
├── getDrinkById/            # GET /drinks/{id}
├── createOrder/             # POST /orders
├── getMyOrders/             # GET /orders
├── getOrderStatus/          # GET /orders/{id}
├── register/                # POST /register
├── refreshToken/            # POST /auth/refresh
├── getAllDrinksAdmin/        # GET /admin/drinks
├── createDrink/             # POST /admin/drinks
├── updateDrink/             # PUT /admin/drinks/{id}
├── deleteDrink/             # DELETE /admin/drinks/{id}
├── getAllOrders/             # GET /admin/orders
├── updateOrderStatus/       # PUT /admin/orders/{id}
├── createSection/           # POST /admin/sections
├── updateSection/           # PUT /admin/sections/{id}
├── deleteSection/           # DELETE /admin/sections/{id}
├── createRegistrationCode/  # POST /admin/registration-codes
├── getRegistrationCodes/    # GET /admin/registration-codes
├── deleteRegistrationCode/  # DELETE /admin/registration-codes/{code}
├── generatePresignedUrl/    # POST /admin/images/upload-url
├── corsOptions/             # OPTIONS (CORS preflight)
└── shared/                  # Lambda Layer (cache_utils, event_publisher)
```
