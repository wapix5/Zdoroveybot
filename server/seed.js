import { db } from "./db.js";

db.exec("DELETE FROM order_items; DELETE FROM orders; DELETE FROM products;");

const insert = db.prepare(
  "INSERT INTO products (category,name,price,qty,image) VALUES (?,?,?,?,?)"
);

[
  ["Спортпит", "Креатин Monohydrate", 800, 10, "assets/demo.jpg"],
  ["Витамины", "Vitamin D3", 550, 6, "assets/demo.jpg"],
  ["БАД", "Ashwagandha", 1500, 4, "assets/demo.jpg"]
].forEach(p => insert.run(p[0], p[1], p[2], p[3], p[4]));

console.log("База заполнена тестовыми товарами.");
