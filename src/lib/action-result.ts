/** Uniform return shape for server actions consumed by forms + toasts. */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Turns Postgres / PostgREST errors into messages a user can act on. */
export function dbErrorMessage(error: { code?: string; message: string; details?: string | null }): string {
  switch (error.code) {
    case "23505":
      if (error.message.includes("cnic")) return "A client with this CNIC already exists.";
      if (error.message.includes("passport")) return "A client with this passport number already exists.";
      if (error.message.includes("units_no")) return "A unit with this number already exists here.";
      if (error.message.includes("code")) return "This project code is already in use.";
      return "This record already exists.";
    case "23514":
      return "Some values are not valid (check the format of CNIC, phone and amounts).";
    case "42501":
      return error.message.includes("row-level security")
        ? "You don't have permission to do this."
        : error.message;
    case "P0001":
      return error.message;
    default:
      return error.message || "Something went wrong. Please try again.";
  }
}
