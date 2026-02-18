-- =============================================================================
-- AI Bartender - Full Database Schema
-- Sets up the complete database for Aurora DSQL
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Schema
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS cocktails;
GRANT USAGE ON SCHEMA cocktails TO PUBLIC;
GRANT CREATE ON SCHEMA cocktails TO PUBLIC;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

-- Sections: organize drinks into categories
CREATE TABLE cocktails.sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Drinks: the menu items
CREATE TABLE cocktails.drinks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    ingredients TEXT NOT NULL,
    recipe TEXT,
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Users: admin authentication
CREATE TABLE cocktails.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    cognito_sub VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Orders: drink orders
CREATE TABLE cocktails.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drink_id UUID NOT NULL,
    user_session_id VARCHAR(100),
    user_key UUID,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- App Users: guest authentication (separate from admin users)
CREATE TABLE cocktails.app_users (
    user_key UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    -- Aurora DSQL doesn't support JSON/JSONB as column types; store JSON as text
    metadata TEXT DEFAULT '{}'
);

-- Registration Codes: one-time or multi-use registration links
CREATE TABLE cocktails.registration_codes (
    code UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT false,
    used_at TIMESTAMP,
    -- Aurora DSQL doesn't enforce foreign keys; validate in application layer
    used_by_user_key UUID,
    notes TEXT,
    max_uses INTEGER,
    use_count INTEGER
);

-- Refresh Tokens: store hashes only
CREATE TABLE cocktails.refresh_tokens (
    token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Aurora DSQL doesn't enforce foreign keys; validate in application layer
    user_key UUID NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP,
    is_revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP,
    device_info TEXT
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

-- Drinks
CREATE INDEX ASYNC IF NOT EXISTS idx_drinks_section_id ON cocktails.drinks(section_id);
CREATE INDEX ASYNC IF NOT EXISTS idx_drinks_is_active ON cocktails.drinks(is_active);
CREATE INDEX ASYNC IF NOT EXISTS idx_drinks_section_active ON cocktails.drinks(section_id, is_active);

-- Users
CREATE INDEX ASYNC IF NOT EXISTS idx_users_email ON cocktails.users(email);
CREATE INDEX ASYNC IF NOT EXISTS idx_users_cognito_sub ON cocktails.users(cognito_sub);

-- Orders
CREATE INDEX ASYNC IF NOT EXISTS idx_orders_status ON cocktails.orders(status);
CREATE INDEX ASYNC IF NOT EXISTS idx_orders_user_session ON cocktails.orders(user_session_id);
CREATE INDEX ASYNC IF NOT EXISTS idx_orders_created_at ON cocktails.orders(created_at);
CREATE INDEX ASYNC IF NOT EXISTS idx_orders_drink_id ON cocktails.orders(drink_id);
CREATE INDEX ASYNC IF NOT EXISTS idx_orders_status_created ON cocktails.orders(status, created_at);
CREATE INDEX ASYNC IF NOT EXISTS idx_orders_user_key ON cocktails.orders(user_key);

-- App Users
CREATE INDEX ASYNC IF NOT EXISTS idx_app_users_username ON cocktails.app_users(username);
CREATE INDEX ASYNC IF NOT EXISTS idx_app_users_created_at ON cocktails.app_users(created_at);

-- Registration Codes
CREATE INDEX ASYNC IF NOT EXISTS idx_registration_codes_used ON cocktails.registration_codes(is_used);
CREATE INDEX ASYNC IF NOT EXISTS idx_registration_codes_expires ON cocktails.registration_codes(expires_at);
CREATE INDEX ASYNC IF NOT EXISTS idx_registration_codes_used_by ON cocktails.registration_codes(used_by_user_key);

-- Refresh Tokens
CREATE INDEX ASYNC IF NOT EXISTS idx_refresh_tokens_user ON cocktails.refresh_tokens(user_key);
CREATE INDEX ASYNC IF NOT EXISTS idx_refresh_tokens_hash ON cocktails.refresh_tokens(token_hash);
CREATE INDEX ASYNC IF NOT EXISTS idx_refresh_tokens_expires ON cocktails.refresh_tokens(expires_at);

-- -----------------------------------------------------------------------------
-- Roles
-- Update the IAM ARNs below to match your AWS account and roles
-- -----------------------------------------------------------------------------

-- Writer role: full CRUD access for Lambda functions
CREATE ROLE lambda_drink_writer WITH LOGIN;
GRANT USAGE ON SCHEMA cocktails TO lambda_drink_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA cocktails TO lambda_drink_writer;
-- Run manually after deploying the datastore stack:
-- AWS IAM GRANT lambda_drink_writer TO 'arn:aws:iam::<ACCOUNT_ID>:role/<APPLICATION>-data-writer-role';

-- Reader role: read-only access for Lambda functions
CREATE ROLE lambda_drink_reader WITH LOGIN;
GRANT USAGE ON SCHEMA cocktails TO lambda_drink_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA cocktails TO lambda_drink_reader;
-- Run manually after deploying the datastore stack:
-- AWS IAM GRANT lambda_drink_reader TO 'arn:aws:iam::<ACCOUNT_ID>:role/<APPLICATION>-data-reader-role';
