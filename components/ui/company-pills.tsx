"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Source } from "@/types"
import { motion } from "framer-motion"

interface Company {
    id: string;
    name: string;
    sources: Source[];
}

interface CompanyPillsProps {
    companies: Company[]
    selectedCompany: Company | null
    onSelect: (company: Company) => void
    className?: string
}

export function CompanyPills({
    companies,
    selectedCompany,
    onSelect,
    className,
}: CompanyPillsProps) {
    return (
        <div className={cn("w-full overflow-x-auto no-scrollbar pb-2", className)}>
            <div className="flex space-x-2 min-w-max px-1">
                {companies.map((company) => {
                    const isSelected = selectedCompany?.id === company.id
                    return (
                        <button
                            key={company.id}
                            onClick={() => onSelect(company)}
                            className={cn(
                                "relative inline-flex items-center justify-center rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200",
                                isSelected
                                    ? "text-primary-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {isSelected && (
                                <motion.div
                                    layoutId="active-pill"
                                    className="absolute inset-0 rounded-full bg-primary shadow-md"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            <span className="relative z-10 flex items-center">
                                {company.name}
                                <span className={cn("ml-2 text-[10px]", isSelected ? "text-primary-foreground/80" : "text-muted-foreground/70")}>
                                    {company.sources.length}
                                </span>
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
