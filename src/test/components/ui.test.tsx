import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@/test/test-utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

describe("UI Components", () => {
  describe("Button", () => {
    it("renders correctly with text", () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
    });

    it("handles click events", () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      fireEvent.click(screen.getByRole("button"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("can be disabled", () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("renders different variants", () => {
      const { rerender } = render(<Button variant="default">Default</Button>);
      expect(screen.getByRole("button")).toHaveClass("bg-primary");

      rerender(<Button variant="destructive">Destructive</Button>);
      expect(screen.getByRole("button")).toHaveClass("bg-destructive");

      rerender(<Button variant="outline">Outline</Button>);
      expect(screen.getByRole("button")).toHaveClass("border");
    });
  });

  describe("Card", () => {
    it("renders card with header and content", () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Card</CardTitle>
          </CardHeader>
          <CardContent>Card content here</CardContent>
        </Card>
      );
      expect(screen.getByText("Test Card")).toBeInTheDocument();
      expect(screen.getByText("Card content here")).toBeInTheDocument();
    });
  });

  describe("Badge", () => {
    it("renders badge with text", () => {
      render(<Badge>New</Badge>);
      expect(screen.getByText("New")).toBeInTheDocument();
    });

    it("renders different variants", () => {
      const { rerender } = render(<Badge variant="default">Default</Badge>);
      expect(screen.getByText("Default")).toHaveClass("bg-primary");

      rerender(<Badge variant="secondary">Secondary</Badge>);
      expect(screen.getByText("Secondary")).toHaveClass("bg-secondary");

      rerender(<Badge variant="destructive">Destructive</Badge>);
      expect(screen.getByText("Destructive")).toHaveClass("bg-destructive");
    });
  });

  describe("Input", () => {
    it("renders input field", () => {
      render(<Input placeholder="Enter text" />);
      expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
    });

    it("handles value changes", () => {
      const handleChange = vi.fn();
      render(<Input onChange={handleChange} />);
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "test" } });
      expect(handleChange).toHaveBeenCalled();
    });

    it("can be disabled", () => {
      render(<Input disabled />);
      expect(screen.getByRole("textbox")).toBeDisabled();
    });
  });
});
