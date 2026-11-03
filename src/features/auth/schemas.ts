import { z } from "zod";

/** Staff sign in with a username; an email is still accepted for accounts that have one. */
export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Enter your username")
    .refine(
      (v) => v.includes("@") || /^[A-Za-z0-9._-]{3,32}$/.test(v),
      "Use your username, or your email address if you have one",
    ),
  password: z.string().min(1, "Enter your password"),
});

export const forgotSchema = z.object({
  email: z.email("Enter a valid email address"),
});

export const resetSchema = z
  .object({
    password: z
      .string()
      .min(10, "Use at least 10 characters")
      .regex(/[A-Za-z]/, "Include a letter")
      .regex(/\d/, "Include a number"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
