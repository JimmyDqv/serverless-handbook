const awsExports = {
  Auth: {
    Cognito: {
      region: process.env.REACT_APP_AWS_REGION,
      userPoolId: process.env.REACT_APP_USER_POOL_ID,
      userPoolClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID,
      signUpVerificationMethod: "code",
      loginWith: {
        oauth: {
          domain: process.env.REACT_APP_COGNITO_DOMAIN,
          scopes: ["openid", "profile", "email"],
          redirectSignIn: process.env.REACT_APP_REDIRECT_SIGN_IN,
          redirectSignOut: process.env.REACT_APP_REDIRECT_SIGN_OUT,
          responseType: "code",
        },
      },
    },
  },
};

export default awsExports;
