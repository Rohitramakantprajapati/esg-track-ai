from typing import Dict, List

from .scoring import BENCHMARKS


def pct_diff(actual: float, benchmark: float) -> float:
    if benchmark == 0:
        return 0.0
    return round(((actual - benchmark) / benchmark) * 100, 2)


def build_gap_analysis(env, social, gov) -> List[Dict]:
    total_employees = max(1, social.total_employees)
    metrics = [
        {
            "metric": "Carbon Intensity",
            "actual": round(env.carbon_emissions_tonnes / total_employees, 2),
            "benchmark": BENCHMARKS["carbon"],
            "lower_is_better": True,
        },
        {
            "metric": "Energy per Employee",
            "actual": round(env.energy_kwh / total_employees, 2),
            "benchmark": BENCHMARKS["energy"],
            "lower_is_better": True,
        },
        {
            "metric": "Water per Employee",
            "actual": round(env.water_litres / total_employees, 2),
            "benchmark": BENCHMARKS["water"],
            "lower_is_better": True,
        },
        {
            "metric": "Waste Recycling %",
            "actual": round((env.recycled_waste_kg / max(1.0, env.waste_kg)) * 100, 2),
            "benchmark": BENCHMARKS["waste_recycling"],
            "lower_is_better": False,
        },
        {
            "metric": "Gender Diversity %",
            "actual": round((social.female_employees / total_employees) * 100, 2),
            "benchmark": BENCHMARKS["gender_diversity"] * 100,
            "lower_is_better": False,
        },
        {
            "metric": "Safety Incidents",
            "actual": social.safety_incidents,
            "benchmark": BENCHMARKS["safety_incidents"],
            "lower_is_better": True,
        },
        {
            "metric": "Training Hours",
            "actual": social.training_hours,
            "benchmark": BENCHMARKS["training_hours"],
            "lower_is_better": False,
        },
        {
            "metric": "Board Independence %",
            "actual": round((gov.independent_directors / max(1, gov.board_members)) * 100, 2),
            "benchmark": BENCHMARKS["board_independence"] * 100,
            "lower_is_better": False,
        },
        {
            "metric": "Audit Meetings",
            "actual": gov.audit_meetings,
            "benchmark": BENCHMARKS["audit_meetings"],
            "lower_is_better": False,
        },
    ]

    for m in metrics:
        diff = pct_diff(m["actual"], m["benchmark"])
        if m["lower_is_better"]:
            status = "good" if m["actual"] <= m["benchmark"] else "bad"
        else:
            status = "good" if m["actual"] >= m["benchmark"] else "bad"
        m["difference_pct"] = diff
        m["status"] = status

    return metrics


def build_recommendations(gap_analysis: List[Dict]) -> List[Dict]:
    recommendations = []
    for gap in gap_analysis:
        if gap["status"] == "bad":
            impact = min(12, max(3, int(abs(gap["difference_pct"]) / 8)))
            if gap["metric"] == "Water per Employee":
                text = "Reduce water consumption by 20%"
            elif gap["metric"] == "Carbon Intensity":
                text = "Cut carbon intensity through cleaner energy procurement"
            elif gap["metric"] == "Waste Recycling %":
                text = "Increase recycling segregation and vendor recovery"
            elif gap["metric"] == "Gender Diversity %":
                text = "Improve female hiring and retention programs"
            elif gap["metric"] == "Safety Incidents":
                text = "Strengthen safety SOP compliance and training"
            elif gap["metric"] == "Training Hours":
                text = "Raise annual training hours per employee"
            elif gap["metric"] == "Board Independence %":
                text = "Add independent directors to board committees"
            elif gap["metric"] == "Audit Meetings":
                text = "Increase audit committee meeting frequency"
            else:
                text = f"Improve {gap['metric'].lower()}"
            recommendations.append(
                {
                    "recommendation": text,
                    "estimated_impact": f"+{impact} ESG points",
                    "priority": impact,
                }
            )

    recommendations.sort(key=lambda item: item["priority"], reverse=True)
    return recommendations[:6]
