"use client";

import { useEffect, useState, useCallback } from "react";
import { getCurrencies } from "@/lib/assets";
import { createClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/supabase/profile";
import { Database } from "@/types/database";
import MainLayout from "@/components/layout/MainLayout";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { User, Save, Eye, EyeOff, Palette } from "lucide-react";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const CURRENCIES = getCurrencies();

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [animationsReady, setAnimationsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [formData, setFormData] = useState({
    nickname: "",
    main_currency: "USD",
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const supabase = createClient();

  const fetchProfile = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        console.error("No user found");
        return;
      }

      console.log("Fetching profile for user:", user.id);

      const profileData = await ensureProfile(user.id);

      if (profileData) {
        console.log("Profile data:", profileData);
        setProfile(profileData);
        setFormData({
          nickname: profileData.nickname || "",
          main_currency: profileData.main_currency || "USD",
        });
      } else {
        setError("Failed to load or create profile");
      }
    } catch (error: unknown) {
      console.error("Error fetching profile:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setError(`Failed to load profile: ${errorMessage}`);
    } finally {
      setLoading(false);
      // Delay animations to ensure smooth transition
      setTimeout(() => {
        setAnimationsReady(true);
        document.body.classList.add("animations-complete");
      }, 100);
    }
  }, [supabase]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("profiles")
        .update({
          nickname: formData.nickname,
          main_currency: formData.main_currency,
        })
        .eq("id", user.id);

      if (error) throw error;

      setMessage("Profile updated successfully!");
      fetchProfile();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An error occurred while updating your profile";
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("New passwords do not match");
      setSaving(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      setSaving(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      setMessage("Password updated successfully!");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setShowPasswordForm(false);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An error occurred while updating your password";
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div
          className={`transition-opacity duration-500 ${
            animationsReady ? "opacity-100" : "opacity-0"
          }`}
          style={{
            transform: animationsReady ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.5s ease, transform 0.5s ease",
          }}
        >
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Messages */}
        {message && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-500 px-4 py-3 rounded-md">
            {message}
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Profile Settings */}
        <div
          className={`bg-card border border-border rounded-lg p-6 transition-all duration-300 ${
            animationsReady ? "animate-bounce-in" : "opacity-0"
          }`}
          style={{ animationDelay: animationsReady ? "0.1s" : "0s" }}
        >
          <div className="flex items-center mb-6">
            <div className="p-2 bg-primary/10 rounded-lg">
              <User className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground ml-3">
              Profile Information
            </h2>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label
                htmlFor="nickname"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Nickname
              </label>
              <input
                id="nickname"
                type="text"
                value={formData.nickname}
                onChange={(e) =>
                  setFormData({ ...formData, nickname: e.target.value })
                }
                className="w-full px-3 py-2 border border-input rounded-md shadow-sm placeholder-muted-foreground  bg-background text-foreground"
                placeholder="Enter your nickname"
              />
            </div>

            <div>
              <label
                htmlFor="main_currency"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Main Currency
              </label>
              <select
                id="main_currency"
                value={formData.main_currency}
                onChange={(e) =>
                  setFormData({ ...formData, main_currency: e.target.value })
                }
                className="w-full px-3 py-2 border border-input rounded-md shadow-sm  bg-background text-foreground"
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.symbol} {currency.name} ({currency.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>

        {/* Security Settings */}
        <div
          className={`bg-card border border-border rounded-lg p-6 transition-all duration-300 ${
            animationsReady ? "animate-bounce-in" : "opacity-0"
          }`}
          style={{ animationDelay: animationsReady ? "0.2s" : "0s" }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Eye className="h-5 w-5 text-blue-500" />
              </div>
              <h2 className="text-lg font-semibold text-foreground ml-3">
                Security
              </h2>
            </div>
            <button
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="flex items-center px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
            >
              {showPasswordForm ? (
                <EyeOff className="h-4 w-4 mr-1" />
              ) : (
                <Eye className="h-4 w-4 mr-1" />
              )}
              {showPasswordForm ? "Hide" : "Change Password"}
            </button>
          </div>

          {showPasswordForm && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      newPassword: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-input rounded-md shadow-sm placeholder-muted-foreground  bg-background text-foreground"
                  placeholder="Enter new password"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-input rounded-md shadow-sm placeholder-muted-foreground  bg-background text-foreground"
                  placeholder="Confirm new password"
                  required
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Theme Settings */}
        <div
          className={`bg-card border border-border rounded-lg p-6 transition-all duration-300 ${
            animationsReady ? "animate-bounce-in" : "opacity-0"
          }`}
          style={{ animationDelay: animationsReady ? "0.3s" : "0s" }}
        >
          <div className="flex items-center mb-6">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Palette className="h-5 w-5 text-purple-500" />
            </div>
            <h2 className="text-lg font-semibold text-foreground ml-3">
              Appearance
            </h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-foreground">Theme</h3>
              <p className="text-sm text-muted-foreground">
                Choose your preferred theme
              </p>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Account Information */}
        <div
          className={`bg-card border border-border rounded-lg p-6 transition-all duration-300 ${
            animationsReady ? "animate-bounce-in" : "opacity-0"
          }`}
          style={{ animationDelay: animationsReady ? "0.4s" : "0s" }}
        >
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Account Information
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Account Created</span>
              <span className="text-foreground">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString()
                  : "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Updated</span>
              <span className="text-foreground">
                {profile?.updated_at
                  ? new Date(profile.updated_at).toLocaleDateString()
                  : "N/A"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
