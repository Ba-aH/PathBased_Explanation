<template>
  <div id="main-layout">
    <div id="nav-bar">
      <div><h1>ExplainGraph</h1></div>
      <div><img src="./liris.png" alt="Logo" height="50" /></div>
      <div class="nav-links">
        <a href="http://localhost:8000/page3.html">Accueil</a>
        <a href="https://liris.cnrs.fr/equipe/tweak">À propos</a>
        <a href="#">Export</a>
        <a href="http://localhost:8000">Paramètres</a>
      </div>
    </div>

    <div id="content-area">
      <div id="left-panel">
        <h3>Panneau de contrôle</h3>
        <label for="user">User</label>
        <input type="text" id="user" v-model="user" placeholder="user_xx" />

        <button class="button" @click="loadPath">Afficher le chemin</button>
        <button class="button" @click="sendPredicatesToServer">Appliquer prédicats</button>
        <button class="button" @click="resetPredicats">Réinitialiser</button>

        <div>Drag & drop les prédicats les plus importants ci-dessous :</div>
        <div id="div1" class="drop-zone" @drop="dropHandler" @dragover="dragoverHandler"></div>
        <div id="listPredicats" @drop="dropHandler" @dragover="dragoverHandler"></div>
      </div>

      <div id="center-panel">
        <div id="affichage-cours"></div>
        <h3>Chemin à partir d'un graphe pondéré</h3>

        <div class="graph-controls">
          <button class="button" @click="resetView">Recentrer le graphe</button>
          <button class="button" @click="resetPath">Réinitialiser chemin</button>
          <input type="text" v-model="searchNode" placeholder="course_xx, user_xx,..." />
          <button class="button" @click="chercherNode">Chercher node</button>
        </div>

        <div>Cliquez sur un noeud pour étendre le graphe</div>

        <div id="graphs-container">
          <div class="g" ref="graphEl"></div>
          <fieldset id="cochePredicats">
            <legend>Choisis les prédicats que tu souhaites afficher (sortant du node cliqué)</legend>
          </fieldset>
        </div>

        <div class="graph-controls">
          <button class="button" @click="ajouterGraph">Ajouter le chemin</button>
          <button class="button" @click="echangerGraph">Echanger le chemin</button>
          <h3>{{ mode }}</h3>
        </div>

        <h3 id="titre2"></h3>
        <div id="g_petit-container"></div>
      </div>

      <div id="right-panel">
        <h3>Explication</h3>
        <p id="Explication">{{ explanation }}</p>

        <h4>Légende</h4>
        <ul>
          <li v-for="(color, type) in legend" :key="type">
            <span :style="{ backgroundColor: color }" class="legend-color"></span> {{ type }}
          </li>
        </ul>

        <h4>Top 5 Attributs</h4>
        <div id="messageTop5">{{ top5Message }}</div>
        <canvas id="top5chart" width="260" height="200"></canvas>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import * as vis from 'vis-network'
import Chart from 'chart.js/auto'

// Références réactives
const user = ref('')
const searchNode = ref('')
const explanation = ref('')
const top5Message = ref('')
const mode = ref('Mode Ajout Graphe Activé')
const graphEl = ref(null)

const legend = reactive({
  'Topic': 'rgb(236, 112, 90)',
  'Utilisateur et Cours recommandé': 'rgb(67, 143, 206)',
  'Cours': 'rgb(245, 221, 6)',
  'Autre': '#bce98f'
})

// Placeholders de données, à lier au graphe plus tard
let network = null
const data = reactive({ nodes: [], edges: [] })

// Fonctions principales (squelette)
function loadPath() {
  console.log("Chargement du chemin pour l'utilisateur :", user.value)
  // Ajoute ici ta logique de chargement de graphe via fetch
  import { ref, reactive, nextTick } from 'vue'
import Chart from 'chart.js/auto'

const user = ref('')
const course = ref('')
const explanation = ref('')
const top5Message = ref('')
let top5ChartInstance = null

const graphData = reactive({ nodes: [], edges: [] })
const network = ref(null) // créé dans onMounted()
const graphEl = ref(null) // ref sur la div principale du graphe

const loadPath = async () => {
  if (!user.value) {
    alert("Veuillez entrer un nom d'utilisateur.")
    return
  }

  try {
    // 1. Obtenir cours recommandé
    const courseResp = await fetch(`/api/random_course?start=${user.value}`)
    const courseData = await courseResp.json()

    if (courseData.error) {
      alert(courseData.error)
      return
    }

    course.value = courseData.course
    document.getElementById("affichage-cours").innerHTML = `Cours recommandé : <strong>${course.value}</strong>`

    // 2. Charger chemin principal
    const pathResp = await fetch(`/api/path?start=${user.value}&end=${course.value}&w=true&choix=false`)
    const pathData = await pathResp.json()

    graphData.nodes = [...pathData.path.nodes]
    graphData.edges = [...pathData.path.edges]
    explanation.value = pathData.texte

    if (network.value) {
      network.value.setData({
        nodes: graphData.nodes,
        edges: graphData.edges
      })
    }

    // 3. Charger chemins alternatifs
    const allPathResp = await fetch(`/api/all_path?start=${user.value}&end=${course.value}&w=true&choix=false`)
    const allPaths = await allPathResp.json()

    const container = document.getElementById("g_petit-container")
    container.innerHTML = ''
    document.getElementById("titre2").innerHTML = "Autres chemins possibles"

    allPaths.forEach((p, i) => {
      const div = document.createElement("div")
      div.className = "g_petit"
      div.id = `g${i}`
      container.appendChild(div)

      // Ex : graph secondaire simplifié
      const miniNetwork = new vis.Network(div, {
        nodes: p.nodes,
        edges: p.edges
      }, {
        nodes: { shape: "dot" },
        edges: { arrows: "to" },
        physics: false
      })

      // Ajouter description / score
      const meta = document.createElement("div")
      meta.innerText = `Longueur: ${p.longueur}, S_rw: ${p.S_rw}, Pattern: ${p.pattern}`
      container.appendChild(meta)
    })

    // 4. Charger top 5 attributs
    const top5Resp = await fetch(`/api/top5?user=${user.value}&course=${course.value}`)
    const top5 = await top5Resp.json()

    const ctx = document.getElementById("top5chart").getContext("2d")

    if (top5ChartInstance) top5ChartInstance.destroy()

    if (Object.keys(top5).length === 0) {
      top5Message.value = "Aucun attribut en commun"
      return
    }

    top5ChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(top5).map(k => k.split("/").pop()),
        datasets: [{
          label: 'Pourcentage de similarité',
          data: Object.values(top5),
          backgroundColor: '#FFFBDE',
          borderColor: '#91C8E4',
          borderWidth: 1
        }]
      },
      options: {
        scales: {
          y: { beginAtZero: true, max: 1 }
        }
      }
    })

  } catch (err) {
    alert("Erreur dans loadPath : " + err.message)
    console.error(err)
  }
}

}

function sendPredicatesToServer() {
  console.log("Envoi des prédicats")
}

function resetPredicats() {
  console.log("Réinitialisation des prédicats")
}

function dropHandler(event) {
  event.preventDefault()
  const data = event.dataTransfer.getData("text")
  event.target.appendChild(document.getElementById(data))
}

function dragoverHandler(event) {
  event.preventDefault()
}

function resetView() {
  if (network) {
    network.fit({ animation: true })
  }
}

function resetPath() {
  console.log("Réinitialisation du chemin")
}

function chercherNode() {
  console.log("Recherche de noeud :", searchNode.value)
}

function ajouterGraph() {
  mode.value = "Mode Ajout Graphe Activé"
}

function echangerGraph() {
  mode.value = "Mode Echange Graphe Activé"
}

onMounted(() => {
  const container = graphEl.value
  if (container) {
    network = new vis.Network(container, data, {
      nodes: { shape: "dot", size: 30 },
      edges: { arrows: "to" },
      physics: { enabled: true }
    })
  }
})
</script>

<style scoped>
@import url('https://cdnjs.cloudflare.com/ajax/libs/vis/4.21.0/vis.min.css');
/* CSS réduit pour démonstration */
#main-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
#content-area {
  display: flex;
  flex: 1;
}
#left-panel, #right-panel {
  width: 300px;
  padding: 16px;
}
#center-panel {
  flex: 1;
  padding: 16px;
}
.button {
  display: block;
  width: 100%;
  margin-top: 8px;
}
.legend-color {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  margin-right: 8px;
}
.g {
  height: 500px;
  border: 2px solid #ccc;
  margin-bottom: 16px;
}
.drop-zone {
  min-height: 60px;
  border: 1px dashed #999;
  margin: 10px 0;
}
</style>
