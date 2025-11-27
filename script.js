// APPLICATION STATE----------------------

function state() {
  const pokemons = [];
  let index = 0;

  class Pokemon {
    constructor(name) {
      this.name = name;
      this.weight = 0;
      this.height = 0;
      this.types = [];
      this.attacks = [];
      this.image = null;
    }

    async init() {
      const data = await fetchPokemonByName(this.name);
      if (!data) return this;

      this.types = Array.isArray(data.types)
        ? data.types.map((t) => t.type.name)
        : [];
      this.attacks = Array.isArray(data.moves)
        ? data.moves.map((m) => m.move.name)
        : [];
      this.weight = data.weight ?? 0;
      this.height = data.height ?? 0;
      // fallback if official-artwork not present
      this.image =
        data.sprites?.other?.["official-artwork"]?.front_default ||
        data.sprites?.front_default ||
        null;

      return this;
    }

    get cleanAttacks() {
      return this.attacks.length > 5 ? this.attacks.slice(0, 5) : this.attacks;
    }
  }

  // FETCH HELPERS-------------------------

  async function fetchPokemonByName(name) {
    try {
      const res = await fetch(
        `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(name)}`
      );
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn("Fetch (by name) error:", e);
      return null;
    }
  }

  async function fetchPokemonByType(type) {
    try {
      const res = await fetch(
        `https://pokeapi.co/api/v2/type/${encodeURIComponent(type)}`
      );
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn("Fetch (by type) error:", e);
      return null;
    }
  }

  // ==============================
  // LOAD MULTIPLE POKEMONS
  // ==============================
  async function getPokemonByType(type, count) {
    pokemons.splice(0);
    index = 0;

    const typeData = await fetchPokemonByType(type);
    if (!typeData || !Array.isArray(typeData.pokemon)) {
      throw new Error("Unable to load type data from API.");
    }

    const available = typeData.pokemon.length;
    if (count > available) count = available;

    for (let i = 0; i < count; i++) {
      const entry = typeData.pokemon[i];
      if (!entry || !entry.pokemon || !entry.pokemon.name) continue;
      const name = entry.pokemon.name;
      const pokemon = await new Pokemon(name).init();
      pokemons.push(pokemon);
    }
  }

  return {
    pokemons,
    getPokemonByType,
    get index() {
      return index;
    },
    set index(val) {
      index = val;
    },
  };
}

// ==================================================
const app = state();

// ==============================
// COMPONENT TEMPLATE
// ==============================
function component() {
  const wrap = document.createElement("div");

  wrap.innerHTML = `
    <div class="pokemon-image" aria-hidden="false">
      <img alt="pokemon image"/>
    </div>

    <div class="pokemon-info">
      <h3 class="pokemon-name" role="heading" aria-level="2"></h3>

      <div class="pokemon-stats">
        <div class="stat">
          <p class="value"></p>
          <p class="label">WEIGHT</p>
        </div>
        <div class="stat">
          <p class="value"></p>
          <p class="label">TYPE</p>
        </div>
        <div class="stat">
          <p class="value"></p>
          <p class="label">HEIGHT</p>
        </div>
      </div>

      <div class="btnContainer">
        <button class="btn" id="moves" type="button">Moves</button>
        <button class="btn" id="search" type="button">Search Another</button>
      </div>
    </div>
  `;

  return wrap;
}

// ==============================
// RENDER FUNCTION (robust)
// ==============================
function render(i) {
  const card = document.querySelector(".pokemon-card");
  card.innerHTML = "";

  const pokemon = app.pokemons[i];
  if (!pokemon) {
    card.textContent = "No Pokémon to display.";
    return;
  }
  const mainType = pokemon.types?.[0]?.toLowerCase();
  if (mainType) {
    card.classList.add(`type-${mainType}`);
  }
  const ui = component();

  const img = ui.querySelector("img");
  if (pokemon.image) {
    img.src = pokemon.image;
    img.alt = `${pokemon.name} artwork`;
  } else {
    img.removeAttribute("src");
    img.alt = `${pokemon.name} (image not available)`;
  }

  ui.querySelector(".pokemon-name").textContent = (
    pokemon.name || "Unknown"
  ).toUpperCase();

  const values = ui.querySelectorAll(".stat .value");
  values[0].textContent = (pokemon.weight ?? 0) + " Hg";
  values[1].textContent = Array.isArray(pokemon.types)
    ? pokemon.types.join(" ").toUpperCase()
    : "—";
  values[2].textContent = (pokemon.height ?? 0) + " Ft";

  card.appendChild(ui);
}

// ==============================
// UI ELEMENTS
// ==============================
const form = document.querySelector("form");
const selectTypeBox = document.querySelector(".selectType");
const card = document.querySelector(".pokemon-card");
const next = document.getElementById("next");
const previous = document.getElementById("previous");
const selectEl = document.getElementById("select");
const countEl = document.getElementById("count");

// Simple loading indicator node
const loadingNode = document.createElement("div");
loadingNode.className = "loading-indicator";
loadingNode.textContent = "Loading…";
loadingNode.style.display = "none";
selectTypeBox.appendChild(loadingNode);

// ==============================
// TOGGLE SCREEN
// ==============================
function toggleHidden() {
  selectTypeBox.classList.toggle("hidden");
  card.classList.toggle("hidden");
  next?.classList.toggle("hidden");
  previous?.classList.toggle("hidden");
}

// Enable/disable UI while loading
function setLoading(isLoading) {
  form.querySelector("input[type='submit']").disabled = isLoading;
  selectEl.disabled = isLoading;
  countEl.disabled = isLoading;
  loadingNode.style.display = isLoading ? "block" : "none";
  form.setAttribute("aria-busy", isLoading ? "true" : "false");
}

// ==============================
// POPULATE SELECT (types list)
// ==============================
const POKEMON_TYPES = [
  "normal",
  "fire",
  "water",
  "grass",
  "electric",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
];

function populateTypes() {
  if (!selectEl) return;
  selectEl.innerHTML = POKEMON_TYPES.map(
    (t) => `<option value="${t}">${t[0].toUpperCase() + t.slice(1)}</option>`
  ).join("");
}
populateTypes();

// ==============================
// FORM SUBMIT (validated + safe)
// ==============================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const type = selectEl.value;
  const count = Number(countEl.value);

  if (!type) {
    alert("Please select a Pokémon type.");
    return;
  }
  if (!Number.isFinite(count) || count <= 0) {
    alert("Please enter a valid count (1 or more).");
    return;
  }

  try {
    setLoading(true);
    await app.getPokemonByType(type, count);
    if (!app.pokemons.length) {
      alert("No pokémon loaded — maybe the API failed or type has no pokémon.");
      setLoading(false);
      return;
    }
    render(app.index);
    toggleHidden();
  } catch (err) {
    console.error("Error loading pokémons:", err);
    alert("Failed to load pokémons. Try again later.");
  } finally {
    setLoading(false);
  }
});

// ==============================
// NAVIGATION (robust click handling)
// ==============================
document.addEventListener("click", (e) => {
  // Use closest so clicks on SVG children still work
  const nextBtn = e.target.closest && e.target.closest("#next");
  const prevBtn = e.target.closest && e.target.closest("#previous");
  const searchBtn = e.target.closest && e.target.closest("#search");
  const movesBtn = e.target.closest && e.target.closest("#moves");

  if (nextBtn) {
    if (app.index < app.pokemons.length - 1) {
      app.index++;
      render(app.index);
    }
    return;
  }

  if (prevBtn) {
    if (app.index > 0) {
      app.index--;
      render(app.index);
    }
    return;
  }

  if (searchBtn) {
    // show search UI again
    toggleHidden();
    return;
  }

  if (movesBtn) {
    const current = app.pokemons[app.index];
    if (!current) return;

    const modal = document.querySelector(".moves-modal");
    const list = document.querySelector(".moves-list");

    list.innerHTML = current.cleanAttacks
      .map((move) => `<li>${move}</li>`)
      .join("");

    modal.classList.remove("hidden");
    return;
  }
});

document.querySelector(".close-moves").addEventListener("click", () => {
  document.querySelector(".moves-modal").classList.add("hidden");
});

document.querySelector(".moves-modal").addEventListener("click", (e) => {
  if (e.target.classList.contains("moves-modal")) {
    e.target.classList.add("hidden");
  }
});
