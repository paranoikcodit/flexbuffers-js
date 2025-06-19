import { bench, group, run } from "mitata";
import { FlexBuffer, serialize, deserialize } from "../index";

// Test data
const smallObject = {
  id: 1,
  name: "John Doe",
  active: true,
  score: 95.5
};

const mediumObject = {
  id: 12345,
  name: "Alice Johnson",
  email: "alice@example.com",
  active: true,
  scores: [85, 92, 78, 96, 88],
  metadata: {
    created: "2023-01-01",
    updated: "2023-12-01",
    tags: ["user", "premium", "verified"]
  }
};

const largeObject = {
  users: Array.from({ length: 100 }, (_, i) => ({
    id: i,
    name: `User ${i}`,
    email: `user${i}@example.com`,
    active: i % 2 === 0,
    scores: Array.from({ length: 10 }, () => Math.floor(Math.random() * 100)),
    metadata: {
      created: `2023-${(i % 12) + 1}-${(i % 28) + 1}`,
      tags: [`tag${i % 5}`, `category${i % 3}`]
    }
  })),
  statistics: {
    totalUsers: 100,
    activeUsers: 50,
    averageScore: 75.5
  }
};

const veryLargeArray = Array.from({ length: 1000 }, (_, i) => ({
  index: i,
  value: Math.random() * 1000,
  label: `item_${i}`,
  enabled: i % 3 === 0
}));

// Pre-serialize buffers for deserialization benchmarks
const smallBuffer = serialize(smallObject);
const mediumBuffer = serialize(mediumObject);
const largeBuffer = serialize(largeObject);
const veryLargeBuffer = serialize(veryLargeArray);

group("FlexBuffers Serialization", () => {
  bench("serialize small object", () => {
    serialize(smallObject);
  });

  bench("serialize medium object", () => {
    serialize(mediumObject);
  });

  bench("serialize large object", () => {
    serialize(largeObject);
  });

  bench("serialize very large array", () => {
    serialize(veryLargeArray);
  });

  bench("serialize primitives", () => {
    serialize(42);
    serialize("Hello, World!");
    serialize(true);
    serialize(null);
    serialize(3.14159);
  });

  bench("serialize mixed array", () => {
    serialize([1, "string", true, null, { nested: "object" }, [1, 2, 3]]);
  });
});

group("FlexBuffers Deserialization", () => {
  bench("deserialize small object", () => {
    deserialize(smallBuffer);
  });

  bench("deserialize medium object", () => {
    deserialize(mediumBuffer);
  });

  bench("deserialize large object", () => {
    deserialize(largeBuffer);
  });

  bench("deserialize very large array", () => {
    deserialize(veryLargeBuffer);
  });
});

group("FlexBuffers Round-trip", () => {
  bench("round-trip small object", () => {
    const buffer = serialize(smallObject);
    deserialize(buffer);
  });

  bench("round-trip medium object", () => {
    const buffer = serialize(mediumObject);
    deserialize(buffer);
  });

  bench("round-trip large object", () => {
    const buffer = serialize(largeObject);
    deserialize(buffer);
  });
});

group("FlexBuffer Class", () => {
  bench("FlexBuffer instance serialization", () => {
    const fb = new FlexBuffer();
    fb.serialize(mediumObject);
  });

  bench("FlexBuffer instance deserialization", () => {
    const fb = new FlexBuffer();
    fb.serialize(mediumObject);
    fb.deserialize();
  });

  bench("FlexBuffer from existing buffer", () => {
    const buffer = serialize(mediumObject);
    const fb = FlexBuffer.fromBuffer(buffer);
    fb.deserialize();
  });
});

group("JSON Comparison", () => {
  bench("JSON.stringify small object", () => {
    JSON.stringify(smallObject);
  });

  bench("JSON.stringify medium object", () => {
    JSON.stringify(mediumObject);
  });

  bench("JSON.stringify large object", () => {
    JSON.stringify(largeObject);
  });

  bench("JSON.parse small object", () => {
    const jsonString = JSON.stringify(smallObject);
    JSON.parse(jsonString);
  });

  bench("JSON.parse medium object", () => {
    const jsonString = JSON.stringify(mediumObject);
    JSON.parse(jsonString);
  });

  bench("JSON.parse large object", () => {
    const jsonString = JSON.stringify(largeObject);
    JSON.parse(jsonString);
  });

  bench("JSON round-trip small object", () => {
    const jsonString = JSON.stringify(smallObject);
    JSON.parse(jsonString);
  });

  bench("JSON round-trip medium object", () => {
    const jsonString = JSON.stringify(mediumObject);
    JSON.parse(jsonString);
  });

  bench("JSON round-trip large object", () => {
    const jsonString = JSON.stringify(largeObject);
    JSON.parse(jsonString);
  });
});

group("Size Comparison", () => {
  bench("FlexBuffer vs JSON size comparison", () => {
    const fbBuffer = serialize(mediumObject);
    const jsonString = JSON.stringify(mediumObject);
    const jsonBuffer = new TextEncoder().encode(jsonString);
    
    const fbSize = fbBuffer.length;
    const jsonSize = jsonBuffer.length;
    const compression = ((jsonSize - fbSize) / jsonSize * 100).toFixed(2);
    
    // This measurement doesn't affect benchmark timing
    // Results: FB: ${fbSize}b, JSON: ${jsonSize}b, Compression: ${compression}%
  });
});

group("Edge Cases", () => {
  const deeplyNested = (() => {
    let obj: any = { value: 42 };
    for (let i = 0; i < 20; i++) {
      obj = { level: i, data: obj };
    }
    return obj;
  })();

  const wideObject = (() => {
    const obj: any = {};
    for (let i = 0; i < 500; i++) {
      obj[`key${i}`] = `value${i}`;
    }
    return obj;
  })();

  bench("serialize deeply nested object", () => {
    serialize(deeplyNested);
  });

  bench("deserialize deeply nested object", () => {
    const buffer = serialize(deeplyNested);
    deserialize(buffer);
  });

  bench("serialize wide object", () => {
    serialize(wideObject);
  });

  bench("deserialize wide object", () => {
    const buffer = serialize(wideObject);
    deserialize(buffer);
  });

  bench("serialize empty structures", () => {
    serialize({});
    serialize([]);
    serialize("");
  });

  bench("serialize special values", () => {
    serialize(Number.MAX_SAFE_INTEGER);
    serialize(Number.MIN_SAFE_INTEGER);
    serialize(0);
    serialize(-0);
  });
});

run();