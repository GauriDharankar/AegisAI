import axios from "axios";

type ApiValidationDetail = {
  msg?: string;
  loc?: Array<string | number>;
  type?: string;
};

function formatDetail(detail: unknown): string | null {
  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }

  if (detail && typeof detail === "object" && "msg" in detail && typeof detail.msg === "string") {
    const message = detail.msg.trim();
    return message || null;
  }

  if (Array.isArray(detail)) {
    const messages = detail.flatMap((item) => {
      if (typeof item === "string") {
        return item.trim() ? [item.trim()] : [];
      }

      if (item && typeof item === "object" && "msg" in item && typeof item.msg === "string") {
        const message = item.msg.trim();
        return message ? [message] : [];
      }

      return [];
    });

    return messages.length ? messages.join(" ") : null;
  }

  return null;
}

export function getErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(error)) {
    const detail = formatDetail(error.response?.data?.detail);
    if (detail) {
      return detail;
    }

    switch (error.response?.status) {
      case 400:
        return "The request could not be completed. Please check the entered details.";
      case 401:
        return "Your email or password is incorrect, or your account is inactive.";
      case 403:
        return "You do not have permission to perform this action.";
      case 404:
        return "The requested user, team, or application could not be found.";
      case 409:
        return "This record already exists.";
      case 422:
        return "Some entered details are invalid. Please check the form and try again.";
      case 500:
        return "The server could not complete this action. Please try again.";
      default:
        return error.message || fallback;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
