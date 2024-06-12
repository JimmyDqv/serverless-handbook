// src/pages/Dashboard.js
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isAuthenticated } from "../utils/auth";
import Header from "../components/Header";
import Footer from "../components/Footer";

const Dashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    isAuthenticated().then((loggedIn) => {
      if (!loggedIn) {
        navigate("/login");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow flex items-center justify-center">
        <h1 className="text-2xl">Dashboard</h1>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
