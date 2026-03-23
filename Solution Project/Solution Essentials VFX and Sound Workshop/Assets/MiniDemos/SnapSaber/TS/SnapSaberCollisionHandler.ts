/**
 * SnapSaberCollisionHandler - TypeScript component for Lens Studio
 * Handles collision detection between the saber and target objects
 * Connects to the ScoreManager to update scores on successful hits
 * Spawns confetti VFX and plays a sound effect on successful hit
 */

import {SnapSaberGlobalManager} from "./SnapSaberGlobalManager"

@component
export class SnapSaberCollisionHandler extends BaseScriptComponent {
  @input
  @hint("The saber object with the collider component")
  saberObject!: SceneObject

  @input
  @hint("Tag or name prefix to identify target objects")
  targetIdentifier: string = "SnapSaberCube"

  @input
  @hint("Confetti VFX prefab to spawn on hit")
  confettiPrefab!: ObjectPrefab

  @input
  @hint("Audio component to play on hit - add an AudioComponent to any scene object and assign it here")
  hitAudio!: AudioComponent

  // Private variables
  private collider: Component
  private scoreManagerComponent: any

  // Tracks hit objects by reference to prevent the overlap event firing twice on the same target
  private recentlyHit: Set<SceneObject> = new Set()

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => {
      this.onStart()
    })
  }

  onStart(): void {
    // Get the collider component from the saber
    if (this.saberObject) {
      this.collider = this.saberObject.getComponent("Physics.ColliderComponent")

      if (!this.collider) {
        print("Error: No collider component found on saber object")
        return
      }

      // Set up collision detection
      this.setupCollisionDetection()
    } else {
      print("Error: Saber object not assigned")
    }

    print("SnapSaber Collision Handler initialized")
  }

  // Set up collision detection events
  private setupCollisionDetection(): void {
    ;(this.collider as any).onOverlapEnter.add((e) => {
      this.onOverlapEnter(e.overlap)
    })
  }

  // Spawns confetti VFX at the position of the hit object, then auto-destroys after 2 seconds
  private spawnConfetti(hitObject: SceneObject): void {
    if (!this.confettiPrefab) {
      print("Warning: No confetti prefab assigned, skipping confetti spawn")
      return
    }

    const hitPosition = hitObject.getTransform().getWorldPosition()
    const confettiInstance = this.confettiPrefab.instantiate(this.sceneObject)

    if (confettiInstance) {
      confettiInstance.getTransform().setWorldPosition(hitPosition)

      // Auto-destroy confetti after 2 seconds
      const startTime = getTime()
      const cleanupEvent = this.createEvent("UpdateEvent")
      cleanupEvent.bind(() => {
        if (getTime() - startTime > 2.0) {
          try {
            confettiInstance.destroy()
          } catch (e) {
            print("Error destroying confetti instance: " + e)
          }
          cleanupEvent.enabled = false
        }
      })
    } else {
      print("Error: Failed to instantiate confetti prefab")
    }
  }

  // Plays the hit sound effect
  private playHitSound(): void {
    if (!this.hitAudio) {
      print("Warning: No audio component assigned, skipping sound")
      return
    }

    try {
      this.hitAudio.play(1)
    } catch (e) {
      print("Error playing hit sound: " + e)
    }
  }

  // Handle overlap event when the saber collides with an object
  private onOverlapEnter(overlap: any): void {
    const collidingObject = overlap.collider.getSceneObject()

    if (collidingObject && collidingObject.name.includes(this.targetIdentifier)) {

      // Guard by object reference instead of name to reliably prevent double hits
      if (this.recentlyHit.has(collidingObject)) return
      this.recentlyHit.add(collidingObject)

      print(`Saber hit target: ${collidingObject.name}`)

      // Spawn confetti and play sound at the hit position
      this.spawnConfetti(collidingObject)
      this.playHitSound()

      // First try using the global manager (most reliable method)
      const globalManager = SnapSaberGlobalManager.getInstance()
      if (globalManager) {
        print("Using global manager to register hit")
        globalManager.registerHit(collidingObject)
        return
      }

      // Attempt to register hit with the component if found
      if (this.scoreManagerComponent && typeof this.scoreManagerComponent.registerHit === "function") {
        print("Calling registerHit on direct score manager")
        try {
          this.scoreManagerComponent.registerHit(collidingObject)
          print("Successfully registered hit via direct component!")
        } catch (e) {
          print("Error calling registerHit: " + e)
          collidingObject.destroy()
        }
      } else {
        print("All score manager methods unavailable, just destroying target")
        collidingObject.destroy()
      }
    }
  }
}