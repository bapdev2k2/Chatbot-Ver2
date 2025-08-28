const bcrypt = require("bcrypt");

async function main() {
  const password = "11102002";
  const hash = await bcrypt.hash(password, 10);
  console.log("Hashed password:", hash);
}

main();
