import { db } from "./db.js";

db.exec(`
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM products;
`);

const insert = db.prepare(`
INSERT INTO products (category,name,price,qty,image)
VALUES (?,?,?,?,?)
`);

[
  ["БАД","Ежовик гребенчатый MANTRA 120 капсул",850,5,"assets/ejovik.jpg"],
  ["БАД","5-HTP / 5-ХТП 60 капсул MANTRA",710,5,"assets/5htp.jpg"],
  ["БАД","B-комплекс MANTRA 60 капсул",540,1,"assets/bcomplex.jpg"],
  ["БАД","Ресвератрол MANTRA 60 капсул",1000,2,"assets/resveratrol.jpg"],
  ["БАД","Куркумин плюс MANTRA 60 капсул",640,2,"assets/curcumin.jpg"],

  ["БАД","Hepasky 60 таблеток",0,5,"https://zdoroveybot-1.onrender.com/assets/hepasky.jpg"],
  ["БАД","Hepcmed Tablets 60",0,5,"assets/hepcmed.jpg"],
  ["БАД","Geptava Uridine-200 60 таб",0,5,"assets/geptava.jpg"],

  ["Лекарства","Entecor-1 (Entecavir 1 mg)",0,5,"assets/entecor1.jpg"],
  ["Лекарства","Entecor-0.5 (Entecavir 0.5 mg)",0,5,"assets/entecor05.jpg"],
  ["Лекарства","Tyfovac (Tenofovir 300 mg)",0,5,"assets/tyfovac.jpg"]

].forEach(p => insert.run(...p));

console.log("База заполнена из Excel 🚀");
