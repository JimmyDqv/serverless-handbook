// src/components/Header.js
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signOut } from "aws-amplify/auth";
import { isAuthenticated } from "../utils/auth";

const Header = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    isAuthenticated().then(setLoggedIn);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      setLoggedIn(false);
      navigate("/login");
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  return (
    <header className="bg-blue-600 p-4 text-white">
      <nav className="flex justify-between">
        <div>
          <Link to="/dashboard" className="mr-4">
            Dashboard
          </Link>
          <Link to="/profile" className="mr-4">
            Profile
          </Link>
          <Link to="/tenant" className="mr-4">
            Tenant
          </Link>
        </div>
        <div>
          {loggedIn ? (
            <button onClick={handleLogout} className="mr-4">
              Logout
            </button>
          ) : (
            <Link to="/login" className="mr-4">
              Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
