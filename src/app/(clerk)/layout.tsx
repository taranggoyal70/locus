import { ClerkProvider } from "@clerk/nextjs";

export default function ClerkLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      dynamic
      // Clerk's styles go into a CSS layer below Tailwind's utilities (declared
      // in layers.css), so the theme classes in ClerkThemed.tsx win over them.
      appearance={{ cssLayerName: "clerk" }}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/"
      localization={{
        signIn: { start: { title: "Sign in to Locus" } },
        signUp: { start: { title: "Create your Locus account" } },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
