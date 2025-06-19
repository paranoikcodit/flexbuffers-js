import { describe, it, expect } from "bun:test";
import { FlexBuffer, serialize, deserialize, isValid } from "../index";

describe("FlexBuffers", () => {
	it("should be able to load the native module", () => {
		const flexbuffers = require("../index");
		expect(flexbuffers).toBeDefined();
		expect(flexbuffers.FlexBuffer).toBeDefined();
		expect(flexbuffers.serialize).toBeDefined();
		expect(flexbuffers.deserialize).toBeDefined();
		expect(flexbuffers.isValid).toBeDefined();
	});

	describe("Basic types", () => {
		it("should encode and decode null", () => {
			const original = null;
			const buffer = serialize(original);
			const decoded = deserialize(buffer);
			expect(decoded).toBe(null);
			expect(isValid(buffer)).toBe(true);
		});

		it("should encode and decode booleans", () => {
			const testCases = [true, false];
			for (const original of testCases) {
				const buffer = serialize(original);
				const decoded = deserialize(buffer);
				expect(decoded).toBe(original);
				expect(isValid(buffer)).toBe(true);
			}
		});

		it("should encode and decode integers", () => {
			const testCases = [0, 1, -1, 42, -42, 123456, -123456, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
			for (const original of testCases) {
				const buffer = serialize(original);
				const decoded = deserialize(buffer);
				expect(decoded).toBe(original);
				expect(isValid(buffer)).toBe(true);
			}
		});

		it("should encode and decode floats", () => {
			const testCases = [0.0, 1.5, -1.5, 3.14159, -3.14159, 123.456, -123.456];
			for (const original of testCases) {
				const buffer = serialize(original);
				const decoded = deserialize(buffer);
				expect(decoded).toBeCloseTo(original, 10);
				expect(isValid(buffer)).toBe(true);
			}
		});

		it("should encode and decode strings", () => {
			const testCases = ["", "hello", "world", "Hello, 世界!", "🚀 FlexBuffers", "with\nnewlines\tand\ttabs"];
			for (const original of testCases) {
				const buffer = serialize(original);
				const decoded = deserialize(buffer);
				expect(decoded).toBe(original);
				expect(isValid(buffer)).toBe(true);
			}
		});
	});

	describe("Complex types", () => {
		it("should encode and decode arrays", () => {
			const testCases = [
				[],
				[1, 2, 3],
				["a", "b", "c"],
				[true, false, true],
				[null, 1, "hello", true],
				[1.5, 2.7, 3.14],
			];
			
			for (const original of testCases) {
				const buffer = serialize(original);
				const decoded = deserialize(buffer);
				expect(decoded).toEqual(original);
				expect(isValid(buffer)).toBe(true);
			}
		});

		it("should encode and decode objects", () => {
			const testCases = [
				{},
				{ name: "John", age: 30 },
				{ isActive: true, score: 95.5 },
				{ data: null, message: "test" },
				{ a: 1, b: 2, c: 3 },
			];
			
			for (const original of testCases) {
				const buffer = serialize(original);
				const decoded = deserialize(buffer);
				expect(decoded).toEqual(original);
				expect(isValid(buffer)).toBe(true);
			}
		});

		it("should encode and decode nested structures", () => {
			const testCases = [
				{ users: [{ name: "Alice", age: 25 }, { name: "Bob", age: 30 }] },
				{ data: { nested: { deeply: { value: 42 } } } },
				{ matrix: [[1, 2], [3, 4], [5, 6]] },
				{ mixed: { numbers: [1, 2, 3], strings: ["a", "b"], bool: true } },
			];
			
			for (const original of testCases) {
				const buffer = serialize(original);
				const decoded = deserialize(buffer);
				expect(decoded).toEqual(original);
				expect(isValid(buffer)).toBe(true);
			}
		});
	});

	describe("FlexBuffer class", () => {
		it("should create and use FlexBuffer instances", () => {
			const fb = new FlexBuffer();
			const original = { message: "Hello, FlexBuffers!", count: 42 };
			
			fb.serialize(original);
			const decoded = fb.deserialize();
			expect(decoded).toEqual(original);
			expect(fb.size()).toBeGreaterThan(0);
		});

		it("should create FlexBuffer from existing buffer", () => {
			const original = { test: "data", value: 123 };
			const buffer = serialize(original);
			
			const fb = FlexBuffer.fromBuffer(buffer);
			const decoded = fb.deserialize();
			expect(decoded).toEqual(original);
			expect(fb.size()).toBe(buffer.length);
		});

		it("should get buffer from FlexBuffer", () => {
			const fb = new FlexBuffer();
			const original = { data: "test" };
			
			fb.serialize(original);
			const buffer = fb.getBuffer();
			expect(Array.isArray(buffer)).toBe(true);
			expect(buffer.length).toBeGreaterThan(0);
			expect(isValid(buffer)).toBe(true);
		});
	});

	describe("Error handling", () => {
		it("should handle invalid buffers", () => {
			const invalidBuffer = [1, 2, 3, 4];
			expect(isValid(invalidBuffer)).toBe(false);
			expect(() => deserialize(invalidBuffer)).toThrow();
		});

		it("should handle empty buffers", () => {
			const emptyBuffer: number[] = [];
			expect(isValid(emptyBuffer)).toBe(false);
			
			const fb = new FlexBuffer();
			expect(() => fb.deserialize()).toThrow();
		});

		it("should handle invalid FlexBuffer creation", () => {
			const invalidBuffer = [1, 2, 3];
			expect(() => FlexBuffer.fromBuffer(invalidBuffer)).toThrow();
		});
	});

	describe("Large data handling", () => {
		it("should handle large arrays", () => {
			const largeArray = Array.from({ length: 1000 }, (_, i) => i);
			const buffer = serialize(largeArray);
			const decoded = deserialize(buffer);
			expect(decoded).toEqual(largeArray);
			expect(isValid(buffer)).toBe(true);
		});

		it("should handle large objects", () => {
			const largeObject: Record<string, number> = {};
			for (let i = 0; i < 100; i++) {
				largeObject[`key${i}`] = i;
			}
			
			const buffer = serialize(largeObject);
			const decoded = deserialize(buffer);
			expect(decoded).toEqual(largeObject);
			expect(isValid(buffer)).toBe(true);
		});

		it("should handle deeply nested structures", () => {
			let nested: any = { value: 42 };
			for (let i = 0; i < 10; i++) {
				nested = { level: i, data: nested };
			}
			
			const buffer = serialize(nested);
			const decoded = deserialize(buffer);
			expect(decoded).toEqual(nested);
			expect(isValid(buffer)).toBe(true);
		});
	});

	describe("Round-trip consistency", () => {
		it("should maintain data integrity through multiple serializations", () => {
			const original = {
				name: "Test",
				value: 42,
				items: [1, 2, 3],
				nested: { a: true, b: false }
			};
			
			let current = original;
			for (let i = 0; i < 5; i++) {
				const buffer = serialize(current);
				current = deserialize(buffer);
				expect(isValid(buffer)).toBe(true);
			}
			
			expect(current).toEqual(original);
		});
	});
});