import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../utils/apiClient";
import { useAuth } from "../context/AuthContext.jsx";

function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await apiClient.post("/auth/login", formData);
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

  return (
    <div className="min-h-screen  flex items-center justify-center px-4 py-12 font-['Roboto',sans-serif]">
      <div className="w-full max-w-lg bg-white rounded-[30px] shadow-lg  p-8 sm:p-10">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Хүний Нөөц
          </h1>
        </div>

        <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          <div className="space-y-2 mb-8">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
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
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>

          <div className="space-y-2 mb-8">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
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
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 pr-12 text-gray-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute inset-y-0 right-3 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
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
                    strokeWidth="2"
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

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-gray-900 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:cursor-not-allowed disabled:opacity-80 mt-8 cursor-pointer"
          >
            {isSubmitting ? "Түр хүлээнэ үү" : "Нэвтрэх"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
