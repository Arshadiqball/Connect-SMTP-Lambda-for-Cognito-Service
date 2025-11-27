// index.mjs (or whatever your Lambda entry file is)

import MailService from "./mail.service.mjs";
import {
  KmsKeyringNode,
  buildClient,
  CommitmentPolicy,
} from "@aws-crypto/client-node";

const { decrypt } = buildClient(
  CommitmentPolicy.REQUIRE_ENCRYPT_ALLOW_DECRYPT
);

// KMS keyring – must match KMSKeyID in your user pool LambdaConfig
const keyring = new KmsKeyringNode({
  keyIds: [process.env.KEY_ARN], // e.g. arn:aws:kms:us-west-1:...:key/a8b0...
});

export const handler = async (event, context) => {
  console.log("CustomEmailSender event:", JSON.stringify(event, null, 2));

  // 1) Decrypt Cognito's encrypted code
  let plainTextCode = "";
  try {
    if (event.request?.code) {
      const { plaintext } = await decrypt(
        keyring,
        Buffer.from(event.request.code, "base64")
      );
      plainTextCode = Buffer.from(plaintext).toString("utf-8");
      console.log("Decrypted code:", plainTextCode);
    } else {
      console.warn("event.request.code is missing");
    }
  } catch (err) {
    console.error("Error decrypting verification code:", err);
    throw err; // for real flows we want this to fail loudly
  }

  const email = event.request?.userAttributes?.email;
  const trigger = event.triggerSource;

  if (!email) {
    console.error("No email in userAttributes, aborting send");
    return event;
  }

  // 2) Route to the correct template based on triggerSource
  switch (trigger) {
    case "CustomEmailSender_AdminCreateUser":
      console.log("Sending OTP email for admin-created user");
      await MailService.sendParentInviteEmail({
        to: email,
        otp: plainTextCode || "",
      });
      break;

    case "CustomEmailSender_SignUp":
      console.log("Sending OTP email for sign-up");
      await MailService.sendOTPEmail({
        to: email,
        otp: plainTextCode || "",
      });
      break;

    case "CustomEmailSender_ForgotPassword":
      console.log("Sending OTP email for password reset");
      await MailService.sendForgotPasswordEmail({
        to: email,
        otp: plainTextCode || "",
      });
      break;

    case "CustomEmailSender_ResendCode":
      console.log("Sending OTP email for resend code");
      await MailService.resendCodeEmail({
        to: email,
        code: plainTextCode || "",
      });
      break;

    default:
      console.warn("Unhandled triggerSource:", trigger);
      break;
  }

  // 3) Always return event back to Cognito
  return event;
};
