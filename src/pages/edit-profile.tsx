import { useEffect, useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import AppHeader from "@/components/layout/app-header";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageUpload } from "@/components/ui/image-upload";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Save, User, Image, Camera, Upload } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Link, useLocation } from "wouter";
import LoadingSpinner from "@/components/ui/loading-spinner";

const profileSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis").optional(),
  lastName: z.string().min(1, "Le nom est requis").optional(),
  bio: z.string().max(500, "La bio ne peut pas dépasser 500 caractères").optional(),
  profileImageUrl: z.string().url("URL d'image invalide").optional().or(z.literal("")),
});

export default function EditProfile() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      bio: user?.bio || "",
      profileImageUrl: user?.profileImageUrl || "",
    },
  });

  // Update form when user data loads
  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        bio: user.bio || "",
        profileImageUrl: user.profileImageUrl || "",
      });
      setImagePreview(user.profileImageUrl || "");
    }
  }, [user, form]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: z.infer<typeof profileSchema>) => {
      return apiRequest("/api/user/profile", {
        method: "PUT",
        body: data,
      });
    },
    onSuccess: (updatedUser) => {
      // Invalider tous les caches liés à l'utilisateur
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/leaderboard"] });

      // Forcer la mise à jour immédiate du cache utilisateur avec les nouvelles données
      queryClient.setQueryData(["/api/auth/user"], updatedUser);

      // Mettre à jour l'aperçu local avec les nouvelles données
      if (updatedUser && typeof updatedUser === 'object' && 'profileImageUrl' in updatedUser) {
        setImagePreview((updatedUser as any).profileImageUrl || "");
      }

      // Pas de refresh automatique, laisser React Query gérer les mises à jour

      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont été sauvegardées avec succès.",
      });
      setLocation("/profile");
    },
    onError: (error: any) => {
      console.error("Profile update error:", error);

      let errorMessage = "Impossible de mettre à jour le profil";

      if (error.status === 413) {
        errorMessage = "L'image est trop volumineuse. Veuillez utiliser une image de moins de 5MB.";
      } else if (error.message?.includes("trop volumineuse")) {
        errorMessage = "L'image est trop volumineuse. Veuillez utiliser une image de moins de 5MB.";
      }

      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleImageUrlChange = (url: string) => {
    setImagePreview(url);
    form.setValue("profileImageUrl", url);
  };

  const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.9): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = document.createElement('img');

      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width = (width * maxWidth) / height;
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Enable image smoothing for better quality
        ctx!.imageSmoothingEnabled = true;
        ctx!.imageSmoothingQuality = 'high';

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Use original format if possible, fallback to JPEG
        const outputFormat = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const compressedDataUrl = canvas.toDataURL(outputFormat, quality);
        
        // Clean up
        URL.revokeObjectURL(img.src);
        resolve(compressedDataUrl);
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Failed to load image'));
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // Validate file type - Accept all common image formats
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];
    if (!validImageTypes.includes(file.type) && !file.type.startsWith('image/')) {
      toast({
        title: "Format non supporté",
        description: "Formats acceptés: JPG, PNG, GIF, WebP, BMP, SVG",
        variant: "destructive",
      });
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Fichier trop volumineux",
        description: "La taille maximale est de 10MB. Veuillez choisir un fichier plus petit.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // For SVG files, convert to data URL directly
      if (file.type === 'image/svg+xml') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          setImagePreview(dataUrl);
          form.setValue("profileImageUrl", dataUrl);
          toast({
            title: "Image SVG uploadée",
            description: "Votre image de profil SVG a été uploadée avec succès.",
          });
          setUploading(false);
        };
        reader.onerror = () => {
          toast({
            title: "Erreur de lecture",
            description: "Impossible de lire le fichier SVG.",
            variant: "destructive",
          });
          setUploading(false);
        };
        reader.readAsDataURL(file);
        return;
      }

      // For other image types, compress if needed
      let processedImage: string;
      if (file.size > 1024 * 1024) { // If larger than 1MB, compress
        processedImage = await compressImage(file, 800, 0.9); // Higher quality for larger images
      } else {
        // For smaller files, just convert to data URL
        const reader = new FileReader();
        processedImage = await new Promise((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      setImagePreview(processedImage);
      form.setValue("profileImageUrl", processedImage);

      toast({
        title: "Image uploadée",
        description: `Votre image de profil (${(file.size / 1024 / 1024).toFixed(2)}MB) a été uploadée avec succès.`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Erreur d'upload",
        description: "Impossible d'uploader l'image. Veuillez réessayer avec un autre fichier.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const onSubmit = (data: z.infer<typeof profileSchema>) => {
    updateProfileMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-dark-bg text-white">
      {/* Background Animation */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 bg-electric-blue rounded-full opacity-20 animate-float"></div>
        <div className="absolute top-40 right-5 w-24 h-24 bg-hot-pink rounded-full opacity-15 animate-pulse-slow"></div>
        <div className="absolute bottom-20 left-5 w-20 h-20 bg-otaku-purple rounded-full opacity-25 animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between p-4 glass-morphism">
          <Link href="/profile">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold electric-blue">Modifier le profil</h1>
            <p className="text-gray-400 text-sm">Personnalisez votre profil otaku</p>
          </div>
        </div>

        <div className="px-4 pb-20">
          <div className="space-y-6">
            {/* Profile Preview */}
            <Card className="bg-card-bg hover:bg-secondary-bg transition-all duration-300 card-hover border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <User className="h-5 w-5" />
                  Aperçu du profil
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Avatar className="h-16 w-16">
                      <AvatarImage
                        src={imagePreview || user?.profileImageUrl}
                        alt="Profile"
                      />
                      <AvatarFallback className="text-xl">
                        {(form.watch("firstName") || user?.firstName || "U").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0 border-2 border-gray-700 bg-card-bg hover:bg-secondary-bg"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-white">
                      {form.watch("firstName") || user?.firstName} {form.watch("lastName") || user?.lastName}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      {form.watch("bio") || user?.bio || "Aucune bio définie"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Edit Form */}
            <Card className="bg-card-bg hover:bg-secondary-bg transition-all duration-300 card-hover border-gray-800">
              <CardContent className="p-6">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">Prénom</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Votre prénom"
                                {...field}
                                className="bg-secondary-bg border-gray-700 text-white"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">Nom</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Votre nom"
                                {...field}
                                className="bg-secondary-bg border-gray-700 text-white"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="profileImageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 text-white">
                            <Image className="h-4 w-4" />
                            Image de profil
                          </FormLabel>
                          <div className="space-y-4">
                            {/* File Upload Button */}
                            <div className="space-y-3">
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.onchange = (e) => {
                                      const file = (e.target as HTMLInputElement).files?.[0];
                                      if (file) {
                                        handleFileUpload(file);
                                      }
                                    };
                                    input.click();
                                  }}
                                  disabled={uploading}
                                  className="flex-1 border-gray-700 text-white hover:bg-white/10"
                                >
                                  {uploading ? (
                                    <LoadingSpinner size="sm" />
                                  ) : (
                                    <>
                                      <Upload className="w-4 h-4 mr-2" />
                                      Choisir une image
                                    </>
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.capture = 'environment';
                                    input.onchange = (e) => {
                                      const file = (e.target as HTMLInputElement).files?.[0];
                                      if (file) {
                                        handleFileUpload(file);
                                      }
                                    };
                                    input.click();
                                  }}
                                  disabled={uploading}
                                  className="border-gray-700 text-white hover:bg-white/10"
                                >
                                  <Camera className="w-4 h-4" />
                                </Button>
                              </div>
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileSelect}
                                className="hidden"
                              />
                            </div>

                            {/* URL Input as alternative */}
                            <div className="relative">
                              <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-gray-700" />
                              </div>
                              <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-card-bg px-2 text-gray-400">ou</span>
                              </div>
                            </div>

                            <FormControl>
                              <Input
                                placeholder="https://example.com/image.jpg"
                                {...field}
                                className="bg-secondary-bg border-gray-700 text-white"
                                onChange={(e) => {
                                  field.onChange(e);
                                  handleImageUrlChange(e.target.value);
                                }}
                              />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Bio</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Parlez-nous de votre passion pour les animés..."
                              {...field}
                              className="bg-secondary-bg border-gray-700 min-h-[100px] text-white"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-3">
                      <Button
                        type="submit"
                        disabled={updateProfileMutation.isPending}
                        className="flex-1 bg-electric-blue hover:bg-electric-blue/80 btn-hover text-white"
                      >
                        {updateProfileMutation.isPending ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Sauvegarder
                          </>
                        )}
                      </Button>
                      <Link href="/profile">
                        <Button variant="outline" className="border-gray-700 text-white hover:bg-white/10">
                          Annuler
                        </Button>
                      </Link>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>


      </div>
    </div>
  );
}