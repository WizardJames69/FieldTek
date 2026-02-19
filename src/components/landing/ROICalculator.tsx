import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Calculator, DollarSign, Clock, Users, TrendingUp, ChevronRight } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { FloatingOrbs } from "./FloatingOrbs";

const FIELDTEK_BASE_PRICE = 99;
const FIELDTEK_PER_TECH_PRICE = 35;
const COMPETITOR_SETUP_FEE = 3000;
const COMPETITOR_PER_TECH_PRICE = 250;
const HOURS_SAVED_PER_TECH_PER_WEEK = 5;
const HOURLY_RATE = 45;

export function ROICalculator() {
  const [technicians, setTechnicians] = useState(5);
  const [currentCost, setCurrentCost] = useState(1500);

  const calculations = useMemo(() => {
    // FieldTek monthly cost
    const fieldtekMonthly = FIELDTEK_BASE_PRICE + (technicians * FIELDTEK_PER_TECH_PRICE);
    
    // Competitor estimated monthly cost (if they don't have current software)
    const competitorMonthly = technicians * COMPETITOR_PER_TECH_PRICE;
    
    // Use the higher of user's current cost or competitor estimate
    const actualCurrentCost = Math.max(currentCost, competitorMonthly * 0.5);
    
    // Monthly and annual savings
    const monthlySavings = Math.max(0, actualCurrentCost - fieldtekMonthly);
    const annualSavings = monthlySavings * 12;
    
    // First year savings including avoided setup fees
    const firstYearSavings = annualSavings + COMPETITOR_SETUP_FEE;
    
    // Time savings
    const weeklyHoursSaved = technicians * HOURS_SAVED_PER_TECH_PER_WEEK;
    const monthlyHoursSaved = weeklyHoursSaved * 4;
    const annualHoursSaved = weeklyHoursSaved * 52;
    
    // Value of time saved
    const annualTimeSavingsValue = annualHoursSaved * HOURLY_RATE;
    
    // Total value (savings + time value)
    const totalAnnualValue = annualSavings + annualTimeSavingsValue;

    return {
      fieldtekMonthly,
      monthlySavings,
      annualSavings,
      firstYearSavings,
      weeklyHoursSaved,
      monthlyHoursSaved,
      annualHoursSaved,
      annualTimeSavingsValue,
      totalAnnualValue,
    };
  }, [technicians, currentCost]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <section id="roi" className="py-16 bg-muted/30 overflow-hidden relative">
      {/* Floating orb */}
      <FloatingOrbs variant="primary" count={1} intensity="subtle" />
      
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-12 header-spotlight"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Calculator className="h-4 w-4" />
            ROI Calculator
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            See Your Potential Savings
          </h2>
          <p className="text-lg text-muted-foreground">
            Find out how much time and money your team could save with FieldTek.
          </p>
        </motion.div>

        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="section-glass p-6 md:p-8"
          >
            <div className="grid md:grid-cols-2 gap-8 md:gap-12">
              {/* Input Section */}
              <div className="space-y-8">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Tell us about your team
                </h3>

                {/* Technicians Slider */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-foreground">
                      Number of Technicians
                    </label>
                    <span className="text-2xl font-bold text-primary">{technicians}</span>
                  </div>
                  <Slider
                    value={[technicians]}
                    onValueChange={(value) => setTechnicians(value[0])}
                    min={1}
                    max={50}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1</span>
                    <span>25</span>
                    <span>50</span>
                  </div>
                </div>

                {/* Current Cost Slider */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-foreground">
                      Current Monthly Software Cost
                    </label>
                    <span className="text-2xl font-bold text-primary">{formatCurrency(currentCost)}</span>
                  </div>
                  <Slider
                    value={[currentCost]}
                    onValueChange={(value) => setCurrentCost(value[0])}
                    min={0}
                    max={10000}
                    step={50}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>$0</span>
                    <span>$5,000</span>
                    <span>$10,000</span>
                  </div>
                </div>

                {/* FieldTek Price Display */}
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Your FieldTek Monthly Cost</span>
                    <span className="text-xl font-bold text-primary">
                      {formatCurrency(calculations.fieldtekMonthly)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    ${FIELDTEK_BASE_PRICE} base + ${FIELDTEK_PER_TECH_PRICE}/technician
                  </p>
                </div>
              </div>

              {/* Results Section */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Your Estimated Savings
                </h3>

                {/* Savings Cards */}
                <div className="grid gap-4">
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                    className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">Annual Software Savings</p>
                        <p className="text-2xl font-bold text-foreground">
                          {formatCurrency(calculations.annualSavings)}
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                    className="bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-accent-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">Hours Saved Per Year</p>
                        <p className="text-2xl font-bold text-foreground">
                          {calculations.annualHoursSaved.toLocaleString()} hours
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Worth {formatCurrency(calculations.annualTimeSavingsValue)} at ${HOURLY_RATE}/hr
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: 0.4 }}
                    className="bg-gradient-to-br from-primary to-primary/80 rounded-xl p-4 text-primary-foreground"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-primary-foreground/80">Total Annual Value</p>
                        <p className="text-3xl font-bold">
                          {formatCurrency(calculations.totalAnnualValue)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </div>

                <Button asChild size="lg" className="w-full mt-4 group btn-3d">
                  <Link to="/demo-sandbox">
                    Start Saving Today
                    <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  14-day trial with full Professional access
                </p>
              </div>
            </div>
          </motion.div>

          {/* Disclaimer */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="text-xs text-muted-foreground text-center mt-6"
          >
            * Estimates based on industry averages. Actual savings may vary based on your specific situation.
            Time savings calculated at {HOURS_SAVED_PER_TECH_PER_WEEK} hours per technician per week.
          </motion.p>
        </div>
      </div>
    </section>
  );
}

