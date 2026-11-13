import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandMark } from "@/components/common";
import { apiPost } from "@/lib/api";
import { errMsg } from "@/lib/format";
import { beginSession } from "@/lib/session";
import { queryClient } from "@/lib/queryClient";
import type { UserOut } from "@/lib/types";
import { panelPath } from "./Landing";

export default function Login() {
  const [params] = useSearchParams();
  const shop = params.get("shop") ?? undefined;
  const next = params.get("next");
  const nav = useNavigate();
  const [tab, setTab] = useState(params.get("ref") ? "register" : "login");
  const [login, setLogin] = useState({ email: "", password: "" });
  const [reg, setReg] = useState({ name: "", phone: "", email: "", password: "", ref_code: params.get("ref") ?? "" });

  const done = (u: UserOut) => {
    beginSession();
    queryClient.setQueryData(["me"], u);
    toast.success(`Bem-vindo, ${u.name.split(" ")[0]}!`);
    nav(next ?? panelPath(u.role, u.role === "client" ? shop : u.shop_slug), { replace: true });
  };
  const loginM = useMutation({ mutationFn: () => apiPost<UserOut>("/auth/login", login), onSuccess: done, onError: (e) => toast.error(errMsg(e)) });
  const regM = useMutation({
    mutationFn: () => apiPost<UserOut>("/auth/register", { ...reg, shop_slug: shop, ref_code: reg.ref_code || undefined }),
    onSuccess: done,
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="flex min-h-screen flex-col items-start px-5 py-6 sm:items-center sm:justify-center">
      <BrandMark />
      <div className="mt-10 w-full max-w-md animate-fade-up sm:mt-8">
        <p className="overline">Acesso</p>
        <h1 className="mt-1 text-3xl font-bold text-white">{tab === "login" ? "Entre na sua conta" : "Crie sua conta"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Uma única conta para agendar em qualquer barbearia da plataforma.</p>
        <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login" data-testid="tab-login">Entrar</TabsTrigger>
            <TabsTrigger value="register" data-testid="tab-register">Cadastrar</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); loginM.mutate(); }}>
              <div className="space-y-1.5"><Label>E-mail</Label>
                <Input data-testid="login-email-input" type="email" required value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} className="h-12" /></div>
              <div className="space-y-1.5"><Label>Senha</Label>
                <Input data-testid="login-password-input" type="password" required value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} className="h-12" /></div>
              <Button data-testid="login-submit-button" type="submit" disabled={loginM.isPending} className="h-12 w-full text-base">
                {loginM.isPending && <Loader2 className="size-4 animate-spin" />} Entrar
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="register">
            <form className="mt-4 space-y-3.5" onSubmit={(e) => { e.preventDefault(); regM.mutate(); }}>
              <div className="space-y-1.5"><Label>Nome completo</Label>
                <Input data-testid="register-name-input" required value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} className="h-12" /></div>
              <div className="space-y-1.5"><Label>WhatsApp</Label>
                <Input data-testid="register-phone-input" required inputMode="tel" placeholder="(31) 99999-9999" value={reg.phone} onChange={(e) => setReg({ ...reg, phone: e.target.value })} className="h-12" /></div>
              <div className="space-y-1.5"><Label>E-mail</Label>
                <Input data-testid="register-email-input" type="email" required value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} className="h-12" /></div>
              <div className="space-y-1.5"><Label>Senha (mín. 6 caracteres)</Label>
                <Input data-testid="register-password-input" type="password" required minLength={6} value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} className="h-12" /></div>
              {shop && (
                <div className="space-y-1.5"><Label>Código de indicação (opcional)</Label>
                  <Input data-testid="register-ref-input" value={reg.ref_code} onChange={(e) => setReg({ ...reg, ref_code: e.target.value.toUpperCase() })} className="h-12 font-mono" /></div>
              )}
              <Button data-testid="register-submit-button" type="submit" disabled={regM.isPending} className="h-12 w-full text-base">
                {regM.isPending && <Loader2 className="size-4 animate-spin" />} Criar conta
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
