"use client";

import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus = "pending" | "active" | "completed";

export interface Step {
  id: string;
  label: string;
  description?: string;
  status: StepStatus;
}

interface StatusStepperProps {
  steps: Step[];
  className?: string;
}

export function StatusStepper({ steps, className }: StatusStepperProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-start justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex-1 flex items-center">
            <div className="flex flex-col items-center w-full">
              {/* Step circle */}
              <motion.div
                initial={false}
                animate={{
                  scale: step.status === "active" ? 1.1 : 1,
                }}
                className={cn(
                  "relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
                  step.status === "completed" && "bg-gray-400 text-black shadow-lg",
                  step.status === "active" && "bg-primary/10 border-2 border-primary",
                  step.status === "pending" && "bg-gray-800 border-2 border-gray-600"
                )}
              >
                {step.status === "completed" && (
                  <Check className="h-5 w-5 text-black font-bold" />
                )}
                {step.status === "active" && (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                )}
                {step.status === "pending" && (
                  <span className="text-gray-400 font-semibold text-sm">{index + 1}</span>
                )}
              </motion.div>

              {/* Step label */}
              <div className="mt-4 text-center">
                <p
                  className={cn(
                    "text-sm font-medium transition-colors leading-tight",
                    step.status === "completed" && "text-gray-300",
                    step.status === "active" && "text-white",
                    step.status === "pending" && "text-gray-500"
                  )}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className={cn(
                    "text-xs mt-1 max-w-[100px] leading-tight",
                    step.status === "completed" && "text-gray-400",
                    step.status === "active" && "text-gray-300",
                    step.status === "pending" && "text-gray-600"
                  )}>
                    {step.description}
                  </p>
                )}
              </div>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className="flex-1 mx-6 mt-6">
                <div className="relative h-0.5 bg-gray-700">
                  <motion.div
                    className="absolute top-0 left-0 h-full bg-gray-400"
                    initial={{ width: "0%" }}
                    animate={{
                      width:
                        step.status === "completed"
                          ? "100%"
                          : step.status === "active"
                          ? "50%"
                          : "0%",
                    }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}