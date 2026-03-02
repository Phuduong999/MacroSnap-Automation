import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import { App } from "./App.tsx";

const root = document.getElementById("root")!;
createRoot(root).render(
  <MantineProvider defaultColorScheme="dark">
    <App />
  </MantineProvider>
);
