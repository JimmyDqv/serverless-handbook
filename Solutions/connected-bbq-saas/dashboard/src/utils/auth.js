// src/utils/auth.js
import { getCurrentUser } from "aws-amplify/auth";

export const isAuthenticated = async () => {
  try {
    await getCurrentUser();
    return true;
  } catch {
    return false;
  }
};
