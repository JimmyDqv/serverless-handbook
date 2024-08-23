// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Amplify } from "aws-amplify";
import Login from './pages/Login';
import Profile from './pages/Profile';
import Tenant from './pages/Tenant';
import Dashboard from './pages/Dashboard';

import awsExports from "./aws-exports";
Amplify.configure(awsExports);

console.log(awsExports);

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile/>} />
        <Route path="/tenant" element={<Tenant/>} />
        <Route path="/dashboard" element={<Dashboard/>} />
        <Route path="/" element={<Dashboard/>} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;