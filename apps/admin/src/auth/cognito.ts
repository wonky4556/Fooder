import { Amplify } from 'aws-amplify';
import { config } from '../config';

export function configureAmplify(): void {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: config.cognito.userPoolId,
        userPoolClientId: config.cognito.userPoolClientId,
        loginWith: {
          oauth: {
            domain: config.cognito.domain,
            scopes: ['openid', 'email', 'profile'],
            redirectSignIn: [config.cognito.redirectSignIn],
            redirectSignOut: [config.cognito.redirectSignOut],
            responseType: 'code',
          },
        },
      },
    },
  });
}
