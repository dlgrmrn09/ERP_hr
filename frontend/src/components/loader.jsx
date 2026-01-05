import { ColorRing } from "react-loader-spinner";

function Loader({ size = 64 }) {
  return (
    <ColorRing
      visible
      height={size}
      width={size}
      colors={["#0f172a", "#22c55e", "#0ea5e9", "#6366f1", "#f59e0b"]}
      ariaLabel="loading-indicator"
    />
  );
}

export default Loader;
