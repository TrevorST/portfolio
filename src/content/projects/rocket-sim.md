---
title: Genetic Algorithm Rocket Sim
summary: Rockets learn to reach a target through a genetic algorithm, with AABB collision detection. Built in Python.
status: archived
stack: [Python, Pygame]
cover: ../../assets/projects/rocket-sim.webp
coverAlt: A population of rockets, drawn as outlined rectangles with green thrust trails, clustered beneath a white barrier.
order: 12
---

A population of rockets starts with random thrust sequences. Each generation, the ones that get closest to the target breed, mutate and try again, until the population finds its way past the obstacle.

Collisions use axis-aligned bounding boxes (AABB). Rendering is Pygame.
