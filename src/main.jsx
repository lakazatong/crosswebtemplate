import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import faviconUrl from "./assets/icons/favicon.ico?url";

document.querySelector("link[rel='icon']").href = faviconUrl;

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
