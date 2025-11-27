# Cognito Custom Email Sender Lambda

This Lambda integrates with Amazon Cognito’s **CustomEmailSender** trigger to send branded OTP and notification emails through SMTP (Office365 by default). Cognito encrypts the verification code that arrives in the trigger payload; the function uses the AWS Encryption SDK with a KMS keyring to decrypt that payload before delegating to reusable mail templates in `mail.service.mjs`.

## How It Works
- `index.mjs` is the Lambda handler. It:
  1. Builds a `KmsKeyringNode` using the same symmetric key configured in your Cognito user pool.
  2. Decrypts `event.request.code` and routes the request by `triggerSource`.
  3. Calls the appropriate helper in `mail.service.mjs` to send the email through Nodemailer/SMTP.
- `mail.service.mjs` configures a shared Nodemailer transporter and exposes helper functions for each Cognito trigger (sign-up, admin create user, forgot password, resend).

## Prerequisites
- Node.js 18.x runtime (matches the AWS Lambda execution environment).
- An activated Custom Email Sender Lambda configuration on your Cognito User Pool with:
  - **KMS key** (symmetric, same region as the user pool) accessible to the Lambda execution role.
  - `LambdaConfig.CustomEmailSender` referencing this function (ARN + KMS key ID).
- SMTP credentials with permission to send email from your chosen domain (Office365 examples included).

## Environment Variables
| Name | Required | Description |
| --- | --- | --- |
| `KEY_ARN` | ✅ | ARN of the symmetric KMS key that Cognito used in the user pool’s Custom Email Sender settings. |
| `AWS_REGION` / `AWS_DEFAULT_REGION` | ✅ | Region used to initialize AWS clients (falls back to `us-east-1`). |
| `SMTP_EMAIL` or `O365_USER` | ✅ | SMTP username / mailbox that will send emails. |
| `SMTP_PASSWORD` or `O365_PASS` | ✅ | SMTP password / app password. |
| `SMTP_HOST` | optional | Defaults to `smtp.office365.com`. Change if you use a different provider. |
| `SMTP_PORT` | optional | Defaults to `587` (STARTTLS). |
| `SMTP_FROM_NAME` | optional | Friendly “from” name (defaults to `Hyrise Support`). |

> Tip: keep credentials in AWS Lambda environment variables encrypted with KMS or source them from Secrets Manager/Parameter Store.

## Local Setup
```bash
cd /Users/arshadiqbal/Documents/lambda-emails
npm install
```

To test locally you can invoke the handler with a mocked event:
```bash
node -e 'import("./index.mjs").then(({handler}) =>
  handler({
    triggerSource: "CustomEmailSender_SignUp",
    userPoolId: "us-east-1_example",
    request: {
      userAttributes: { email: "test@example.com" },
      code: "BASE64_ENCRYPTED_CODE"
    }
  })
)'
```
For a real run you must supply a base64 payload that was encrypted with the same KMS key and encryption context Cognito uses.

## Deployment
1. Ensure dependencies are installed (`npm install`).
2. Create an artifact for Lambda:
   ```bash
   rm -rf node_modules && npm install --production
   zip -r lambda-package.zip index.mjs mail.service.mjs package.json package-lock.json node_modules
   ```
3. Upload `lambda-package.zip` to your Lambda function (Console, SAM, or your preferred CI/CD pipeline).
4. Update the Lambda environment variables listed above.

## Cognito Configuration Checklist
- Open your user pool → *Message customizations* → *Email configuration*.
- Enable **Custom email sender** and select this Lambda.
- Choose the same KMS key whose ARN you set in `KEY_ARN`.
- Grant the Lambda execution role permission to:
  - `kms:Decrypt` on the key.
  - `ses:SendRawEmail` or external SMTP (already handled by environment variables) if required.

## Adding New Email Templates
1. Create a new helper in `mail.service.mjs` that builds the HTML body and calls `sendMail`.
2. Extend the switch statement in `index.mjs` with the relevant `triggerSource` constant.
3. Re-deploy.

## Troubleshooting
- **“Not a supported message format version”**: usually means the KMS key or encryption context doesn’t match. Confirm the Cognito user pool is configured with the same key used in `KEY_ARN`.
- **“Unable to decrypt verification code”**: verify the Lambda role has `kms:Decrypt` permissions and the incoming event contains `request.code`.
- **SMTP failures**: ensure `SMTP_EMAIL`/`SMTP_PASSWORD` are set and the provider allows SMTP relay from AWS IPs (Office365 may require an app password + MFA).

## Security Notes
- Never hardcode credentials; rely on environment variables/Secrets Manager.
- Rotate SMTP and KMS keys periodically.
- Consider enabling structured logging (e.g., CloudWatch JSON) and redacting PII if compliance requires.

