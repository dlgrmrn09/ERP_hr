import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../utils/apiClient";
import { useAuth } from "../context/AuthContext.jsx";

function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);
  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const handleForgotPassword = () => {
    if (typeof window !== "undefined") {
      window.open(
        "mailto:hr-support@example.mn?subject=Password%20reset%20request",
        "_blank"
      );
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    const payload = { ...formData, rememberMe };

    try {
      const response = await apiClient.post("/auth/login", payload);
      const userData = response?.data?.user;
      if (userData) {
        login(userData);
      }
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to login";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSubmitDisabled =
    isSubmitting || !formData.email.trim() || !formData.password.trim();

  return (
    <div className="min-h-screen flex items-center bg-linear-to-b from-blue-900 via-blue-950 to-blue-900 px-4 py-12 font-['Roboto',sans-serif]">
      <div className="mx-auto w-full max-w-lg rounded-4xl border border-white/10 bg-white/5 px-8 py-10 text-white shadow-[0_35px_120px_rgba(2,6,23,0.65)] backdrop-blur-xl">
        <h1 className="mt-4 text-3xl font-semibold leading-tight text-white">
          Хүний Нөөцийн Нэгдсэн Систем
        </h1>
        <p className="mt-3 text-sm text-slate-300">
          Энэ Систем нь та өдөр тутмын ажлаа хялбаршуулж, удирдах боломжыг
          олгоно.
        </p>

        <form
          className="mt-8 space-y-6"
          onSubmit={handleSubmit}
          aria-live="polite"
          aria-busy={isSubmitting}
        >
          {error ? (
            <div
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-200"
            >
              Имэйл хаяг
            </label>
            <input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full rounded-2xl border border-white/20 bg-white/90 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-white focus:ring-2 focus:ring-white/50"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-200"
            >
              Нууц үг
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full rounded-2xl border border-white/20 bg-white/90 px-4 py-3 pr-12 text-sm text-slate-900 shadow-sm outline-none transition focus:border-white focus:ring-2 focus:ring-white/50"
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-white"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="M3 3l18 18" />
                    <path d="M10.73 10.73a2 2 0 002.83 2.83" />
                    <path d="M9.88 5.09A9.09 9.09 0 0112 4c5 0 9 4 9 8 0 1.08-.27 2.1-.76 3.02m-3.4 3.78A8.94 8.94 0 0112 20c-5 0-9-4-9-8 0-1.64.5-3.18 1.36-4.5" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-200">
            <label className="flex cursor-pointer items-center gap-3">
              <span className="relative inline-flex h-6 w-11 items-center">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={() => setRememberMe((prev) => !prev)}
                  className="peer sr-only"
                />
                <span className="absolute inset-0 rounded-full bg-white/30 transition peer-checked:bg-emerald-400" />
                <span className="absolute left-1 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
              </span>
              <span>Нэвтэрсэн хэвээр үлдэх</span>
            </label>
            <button
              type="button"
              onClick={handleForgotPassword}
              className="font-semibold text-sky-200 transition hover:text-sky-100"
            >
              Нууц үг мартсан уу?
            </button>
          </div>

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="group w-full rounded-2xl bg-white px-6 py-3 text-base font-semibold text-slate-900 shadow-lg/30 transition hover:-translate-y-0.5 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white/60 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2 text-sm">
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4l3-3-3-3v4a12 12 0 00-12 12h4з"
                  />
                </svg>
                Түр хүлээнэ үү
              </span>
            ) : (
              "Нэвтрэх"
            )}
          </button>

          <p className="text-center text-xs text-slate-300">
            Сүүлд шинэчлэгдсэн:{" "}
            {new Date().toLocaleDateString("mn-MN", {
              month: "long",
              day: "numeric",
            })}
          </p>
        </form>
      </div>
    </div>
  );
}

export default Login;
