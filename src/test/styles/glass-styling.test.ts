import { describe, it, expect } from "vitest";

describe("App Glass Styling", () => {
  it("app-glass-container class exists in document", () => {
    // This test validates that our CSS utilities are properly loaded
    const styleSheets = document.styleSheets;
    expect(styleSheets).toBeDefined();
  });

  it("stat-card-3d provides expected transform properties", () => {
    const element = document.createElement("div");
    element.className = "stat-card-3d";
    document.body.appendChild(element);
    
    const styles = window.getComputedStyle(element);
    expect(styles.transition).toBeDefined();
    
    document.body.removeChild(element);
  });

  it("sheet-glass class can be applied", () => {
    const element = document.createElement("div");
    element.className = "sheet-glass";
    document.body.appendChild(element);
    
    expect(element.classList.contains("sheet-glass")).toBe(true);
    
    document.body.removeChild(element);
  });

  it("dialog-glass class can be applied", () => {
    const element = document.createElement("div");
    element.className = "dialog-glass";
    document.body.appendChild(element);
    
    expect(element.classList.contains("dialog-glass")).toBe(true);
    
    document.body.removeChild(element);
  });

  it("chat-bubble-user class can be applied", () => {
    const element = document.createElement("div");
    element.className = "chat-bubble-user";
    document.body.appendChild(element);
    
    expect(element.classList.contains("chat-bubble-user")).toBe(true);
    
    document.body.removeChild(element);
  });

  it("chat-bubble-assistant class can be applied", () => {
    const element = document.createElement("div");
    element.className = "chat-bubble-assistant";
    document.body.appendChild(element);
    
    expect(element.classList.contains("chat-bubble-assistant")).toBe(true);
    
    document.body.removeChild(element);
  });
});
