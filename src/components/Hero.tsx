import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Heart, Shield, Zap } from "lucide-react";
import { Link } from "react-router-dom";

export const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-subtle">
      {/* Background decorative elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary rounded-full blur-3xl"></div>
      </div>
      
      <div className="container mx-auto px-6 py-32 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/50 backdrop-blur-sm mb-6">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-accent-foreground">
                Software as Medical Device - Certificado
              </span>
            </div>
          </motion.div>
          
          <motion.h1
            className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-primary bg-clip-text text-transparent leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Triagem Inteligente
            <br />
            para Salvar Vidas
          </motion.h1>
          
          <motion.p
            className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Sistema de triagem médica com IA que combina protocolos validados e machine learning 
            para priorização precisa e diagnóstico assistido em tempo real
          </motion.p>
          
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <Link to="/kiosk">
              <Button size="lg" className="group">
                Iniciar Triagem
                <ArrowRight className="group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button size="lg" variant="outline">
                Ver Dashboard
              </Button>
            </Link>
          </motion.div>
          
          {/* Features */}
          <motion.div
            className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <div className="bg-card rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 mx-auto">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Classificação Rápida</h3>
              <p className="text-sm text-muted-foreground">
                Protocolo de Manchester em tempo real
              </p>
            </div>
            
            <div className="bg-card rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center mb-4 mx-auto">
                <Heart className="h-6 w-6 text-secondary" />
              </div>
              <h3 className="font-semibold mb-2">IA Diagnóstica</h3>
              <p className="text-sm text-muted-foreground">
                Sugestões de diagnóstico com ML
              </p>
            </div>
            
            <div className="bg-card rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center mb-4 mx-auto">
                <Shield className="h-6 w-6 text-success" />
              </div>
              <h3 className="font-semibold mb-2">Seguro e Validado</h3>
              <p className="text-sm text-muted-foreground">
                Conforme protocolos médicos
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
