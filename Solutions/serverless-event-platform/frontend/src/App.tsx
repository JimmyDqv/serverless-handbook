import { lazy, Suspense, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "./router";
import { useAuth } from "./context/auth";
import { Nav } from "./components/nav";
import { Footer } from "./components/footer";
import { PageBackground } from "./components/page-background";
import Login from "./pages/Login";

const Home = lazy(() => import("./pages/Home"));
const SchedulePage = lazy(() => import("./pages/SchedulePage"));
const KeynotePage = lazy(() => import("./pages/KeynotePage"));
const GalleryPage = lazy(() => import("./pages/GalleryPage"));
const RsvpPage = lazy(() => import("./pages/RsvpPage"));
const Admin = lazy(() => import("./pages/Admin"));

const routes: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  "/": Home,
  "/schedule": SchedulePage,
  "/keynote": KeynotePage,
  "/gallery": GalleryPage,
  "/rsvp": RsvpPage,
  "/admin": Admin,
};

const glowMap: Record<string, "amber" | "blue" | "mixed"> = {
  "/": "amber",
  "/schedule": "mixed",
  "/keynote": "blue",
  "/gallery": "mixed",
  "/rsvp": "amber",
};

export default function App() {
  const { path, navigate } = useLocation();
  const { isAuthenticated, isAdmin } = useAuth();

  useEffect(() => {
    if (isAuthenticated && path === "/admin" && !isAdmin) {
      navigate("/");
    }
  }, [isAuthenticated, isAdmin, path, navigate]);

  if (!isAuthenticated) {
    return <Login />;
  }

  const Page = routes[path] ?? Home;
  const isAdminPage = path === "/admin";

  if (isAdminPage) {
    return (
      <Suspense>
        <Admin />
      </Suspense>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <PageBackground glow={glowMap[path] ?? "amber"} />
      <Nav />
      <AnimatePresence mode="wait">
        <motion.div
          key={path}
          className="relative z-10 flex-1"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <Suspense>
            <Page />
          </Suspense>
        </motion.div>
      </AnimatePresence>
      <Footer />
    </div>
  );
}
