const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);

if (major < 22) {
  console.error(
    `Rizzfizz requires Node >=22. Current Node is ${process.version}. Run "nvm use" in this directory before installing or running scripts.`
  );
  process.exit(1);
}
