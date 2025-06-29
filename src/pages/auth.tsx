import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  const [registerData, setRegisterData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });

  const loginMutation = useMutation({
    mutationFn: async (data: typeof loginData) => {
      console.log("Sending login data:", data);
      
      try {
        const response = await apiRequest("/api/auth/login", {
          method: "POST",
          body: {
            email: data.email,
            password: data.password,
          },
        });

        console.log("Login response status:", response.status);
        console.log("Login response headers:", Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          let errorData;
          const contentType = response.headers.get("content-type");

          if (contentType && contentType.includes("application/json")) {
            try {
              errorData = await response.json();
            } catch (parseError) {
              console.error("Failed to parse error JSON:", parseError);
              errorData = { message: "Erreur de parsing de la réponse du serveur" };
            }
          } else {
            // La réponse n'est pas du JSON, probablement du HTML
            const textResponse = await response.text();
            console.error("Non-JSON error response:", textResponse);
            errorData = { message: `Erreur serveur (${response.status}): ${response.statusText}` };
          }

          throw new Error(errorData.message || "Email ou mot de passe incorrect");
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const result = await response.json();
          console.log("Login successful, received data:", result);
          return result;
        } else {
          throw new Error("La réponse du serveur n'est pas au format JSON");
        }
      } catch (networkError) {
        console.error("Network or parsing error:", networkError);
        throw networkError;
      }
    },
    onSuccess: (data) => {
      if (data && data.token && data.user) {
        localStorage.setItem("auth_token", data.token);
        toast({
          title: "Connexion réussie",
          description: `Bienvenue ${data.user.firstName} !`,
        });
        setLocation("/");
      } else {
        console.error("Invalid response data:", data);
        toast({
          title: "Erreur de connexion",
          description: "Réponse invalide du serveur",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error("Login error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));

      let errorMessage = "Email ou mot de passe incorrect";

      // Vérifier si c'est une erreur réseau ou de parsing
      if (error?.name === 'SyntaxError') {
        errorMessage = "Erreur de communication avec le serveur";
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      toast({
        title: "Erreur de connexion",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: typeof registerData) => {
      console.log("Sending registration data:", data);
      const response = await apiRequest("/api/auth/register", {
        method: "POST",
        body: {
          email: data.email,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
        },
      });

      console.log("Registration response status:", response.status);
      console.log("Registration response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        let errorData;
        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
          try {
            errorData = await response.json();
          } catch (parseError) {
            console.error("Failed to parse error JSON:", parseError);
            errorData = { message: "Erreur de parsing de la réponse du serveur" };
          }
        } else {
          // La réponse n'est pas du JSON, probablement du HTML
          const textResponse = await response.text();
          console.error("Non-JSON error response:", textResponse);
          errorData = { message: `Erreur serveur (${response.status}): ${response.statusText}` };
        }

        throw new Error(errorData.message || "Une erreur est survenue lors de l'inscription");
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return response.json();
      } else {
        throw new Error("La réponse du serveur n'est pas au format JSON");
      }
    },
    onSuccess: (data) => {
      localStorage.setItem("auth_token", data.token);
      toast({
        title: "Inscription réussie",
        description: `Bienvenue ${data.user.firstName} !`,
      });
      setLocation("/");
    },
    onError: (error: any) => {
      console.error("Registration error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));

      let errorMessage = "Une erreur est survenue lors de l'inscription";

      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      toast({
        title: "Erreur d'inscription",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation basique
    if (!loginData.email || !loginData.password) {
      toast({
        title: "Erreur de validation",
        description: "Email et mot de passe sont requis",
        variant: "destructive",
      });
      return;
    }

    if (!loginData.email.includes('@')) {
      toast({
        title: "Erreur de validation",
        description: "Veuillez entrer une adresse email valide",
        variant: "destructive",
      });
      return;
    }

    loginMutation.mutate(loginData);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation basique
    if (!registerData.email || !registerData.password || !registerData.firstName || !registerData.lastName) {
      toast({
        title: "Erreur de validation",
        description: "Tous les champs sont requis",
        variant: "destructive",
      });
      return;
    }

    if (registerData.password.length < 6) {
      toast({
        title: "Erreur de validation",
        description: "Le mot de passe doit contenir au moins 6 caractères",
        variant: "destructive",
      });
      return;
    }

    if (!registerData.email.includes('@')) {
      toast({
        title: "Erreur de validation",
        description: "Veuillez entrer une adresse email valide",
        variant: "destructive",
      });
      return;
    }

    registerMutation.mutate(registerData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-otaku-purple via-electric-blue to-hot-pink flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-dark-surface/95 backdrop-blur-sm border-electric-blue/20">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-electric-blue to-hot-pink bg-clip-text text-transparent">
            Otaku Platform
          </CardTitle>
          <CardDescription className="text-gray-400">
            Rejoignez la communauté otaku
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-dark-bg">
              <TabsTrigger value="login" className="text-white">
                Connexion
              </TabsTrigger>
              <TabsTrigger value="register" className="text-white">
                Inscription
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-white">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      className="pl-10 bg-dark-bg border-gray-600 text-white"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-white">
                    Mot de passe
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      className="pl-10 pr-10 bg-dark-bg border-gray-600 text-white"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-electric-blue hover:bg-electric-blue/80"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Connexion..." : "Se connecter"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first-name" className="text-white">
                      Prénom
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="first-name"
                        placeholder="Prénom"
                        value={registerData.firstName}
                        onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })}
                        className="pl-10 bg-dark-bg border-gray-600 text-white"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="last-name" className="text-white">
                      Nom
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="last-name"
                        placeholder="Nom"
                        value={registerData.lastName}
                        onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })}
                        className="pl-10 bg-dark-bg border-gray-600 text-white"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-email" className="text-white">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      className="pl-10 bg-dark-bg border-gray-600 text-white"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-password" className="text-white">
                    Mot de passe
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="register-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      className="pl-10 pr-10 bg-dark-bg border-gray-600 text-white"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">
                    Minimum 6 caractères
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-hot-pink hover:bg-hot-pink/80"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? "Inscription..." : "S'inscrire"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}