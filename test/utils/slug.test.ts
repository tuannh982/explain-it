import { describe, expect, it } from "vitest";
import { toSnakeCase } from "../../src/utils/slug.js";

describe("toSnakeCase", () => {
	it("converts simple text to snake_case", () => {
		expect(toSnakeCase("React Hooks")).toBe("react_hooks");
	});

	it("handles special characters", () => {
		expect(toSnakeCase("C++ Templates")).toBe("c_templates");
	});

	it("handles multiple spaces", () => {
		expect(toSnakeCase("GraphQL   Basics")).toBe("graphql_basics");
	});

	it("trims leading/trailing underscores", () => {
		expect(toSnakeCase("  Hello World  ")).toBe("hello_world");
	});

	it("handles already snake_case input", () => {
		expect(toSnakeCase("already_snake")).toBe("already_snake");
	});
});
