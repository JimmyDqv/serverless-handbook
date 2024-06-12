// src/pages/Profile.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAuthenticated } from "../utils/auth";
import { fetchUserAttributes } from "aws-amplify/auth";
import Header from "../components/Header";
import Footer from "../components/Footer";

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    isAuthenticated().then((loggedIn) => {
      if (!loggedIn) {
        navigate("/login");
      } else {
        fetchUserAttributes().then(setUser);
      }
    });
  }, [navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl">Profile</h1>
          <p>Email: {user.email}</p>
          <p>Name: {user.name}</p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Profile;
