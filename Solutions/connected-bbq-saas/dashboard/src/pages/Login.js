// src/pages/Login.js
import React, { useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { isAuthenticated } from "../utils/auth";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";

const Login = () => {
  const navigate = useNavigate();

  useEffect(() => {
    isAuthenticated().then((loggedIn) => {
      if (loggedIn) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow flex items-center justify-center">
        <Authenticator signUpAttributes={["name"]} loginMechanisms={["email"]}>
          {({ signOut, user }) => (
            <Routes>
              <Route path="/" element={<Navigate replace to="/dashboard" />} />
            </Routes>
          )}
        </Authenticator>
      </main>
      <Footer />
    </div>
  );
};

export default Login;
