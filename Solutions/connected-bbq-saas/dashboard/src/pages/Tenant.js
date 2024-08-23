// src/pages/Tenant.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAuthenticated } from "../utils/auth";
import { fetchAuthSession } from "aws-amplify/auth";
import { fetchUserAttributes } from "aws-amplify/auth";
import { get, put } from "aws-amplify/api";
import Header from "../components/Header";
import Footer from "../components/Footer";

const Tenant = () => {
  const updateTenantInfo = async (tenantid, newTenantName) => {
    try {
      const authToken = (await fetchAuthSession()).tokens?.idToken?.toString();

      const restOperation = put({
        apiName: "TenantApi",
        path: "/tenant/" + tenantid,
        options: {
          headers: {
            Authorization: authToken,
          },
          body: {
            name: newTenantName,
          },
        },
      });

      const { body } = await restOperation.response;
      const json = await body.json();

      const updatedInfo = await fetchTenantInfo(tenantid);
      setTenantInfo(updatedInfo);
      setNewTenantName("");
    } catch (error) {
      console.error("Error updating tenant information:", error);
    }
  };

  const fetchTenantId = async () => {
    try {
      const idToken = (await fetchAuthSession()).tokens?.idToken;
      const authToken = idToken?.toString();
      const idTokenPayload = idToken.payload;

      const userId = idTokenPayload["cognito:username"];

      const restOperation = get({
        apiName: "TenantApi",
        path: "/tenants/" + userId,
        options: {
          headers: {
            Authorization: authToken,
          },
        },
      });
      const { body } = await restOperation.response;
      const json = await body.json();

      return json["tenants"][0];
    } catch (error) {
      console.error("Error fetching tenant information:", error);
      throw error;
    }
  };

  const fetchTenantInfo = async () => {
    try {
      const idToken = (await fetchAuthSession()).tokens?.idToken;
      const authToken = idToken?.toString();
      const idTokenPayload = idToken.payload;

      const tenant = idTokenPayload["tenant"];

      const restOperation = get({
        apiName: "TenantApi",
        path: "/tenant/" + tenant,
        options: {
          headers: {
            Authorization: authToken,
          },
        },
      });
      const { body } = await restOperation.response;
      const json = await body.json();

      const { name, tenantid } = json[0];

      return json[0];
    } catch (error) {
      console.error("Error fetching tenant information:", error);
      throw error;
    }
  };

  const navigate = useNavigate();
  const [tenantId, setTenantId] = useState(null);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [newTenantName, setNewTenantName] = useState("");

  useEffect(() => {
    isAuthenticated().then((loggedIn) => {
      if (!loggedIn) {
        navigate("/login");
      } else {
        if (!tenantId) {
          fetchTenantId().then(setTenantId);
        }
        const data = fetchTenantInfo().then(setTenantInfo);
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow flex items-center justify-center">
        <div className="text-center">
          {tenantInfo ? (
            <div>
              <h1 className="text-2xl">Tenant Information</h1>
              <p>Name: {tenantInfo.name}</p>
              <p>ID: {tenantInfo.tenantid}</p>
              <br />
              <label className="block text-sm font-medium text-gray-700">
                Update Tenant Name
              </label>
              <input
                type="text"
                value={newTenantName}
                onChange={(e) => setNewTenantName(e.target.value)}
                className="mt-1 px-3 py-2 border border-gray-300 rounded-md"
              />
              <button
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md"
                onClick={() =>
                  updateTenantInfo(tenantInfo.tenantid, newTenantName)
                }
              >
                Update
              </button>
            </div>
          ) : (
            <p>Loading tenant information...</p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Tenant;
