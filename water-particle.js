import metaversefile from 'metaversefile';
import * as THREE from 'three';
import loadTexture from './loadTexture.js';
import {
  rippleVertex,
  rippleFragment,
} from './water-shader.js';

const {useLoaders, useSound, useInternals} = metaversefile;
const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');
const sounds = useSound();
const soundFiles = sounds.getSoundFiles();

const voronoiNoiseTexture = loadTexture(`../assets/textures/water-particle/textures/voronoiNoise.jpg`);
const noiseMap = loadTexture(`../assets/textures/water-particle/textures/noise.jpg`);
const rippleTexture2 = loadTexture(`../assets/textures/water-particle/textures/ripple2.png`);


class WaterParticleEffect {
  constructor() {
    this.scene = useInternals().sceneLowPriority;
    this.contactWater = false;
    this.contactWater = false;
    this.player = null;
    this.waterSurfaceHeight = 0;

    this.lastContactWater = false;

    this.collisionPosition = new THREE.Vector3();

    this.fallingSpeed = null;
    
    this.rippleMesh = null;
    this.initRipple();
  }
  
  update() {
    if (this.player) {
      // jump in water
      if (this.contactWater && this.contactWater !== this.lastContactWater) {
        this.fallingSpeed = 0 - this.player.characterPhysics.velocity.y;
        this.collisionPosition.set(this.player.position.x, this.waterSurfaceHeight, this.player.position.z);
      }
      else {
        this.fallingSpeed = null;
      }
    }

    const _handleCollisionSfx = () => {
      if (this.fallingSpeed > 1) {
        let regex = new RegExp('^water/jump_water[0-9]*.wav$');
        const candidateAudios = soundFiles.water.filter((f) => regex.test(f.name));
        const audioSpec = candidateAudios[Math.floor(Math.random() * candidateAudios.length)];
        sounds.playSound(audioSpec);
      }
    };
    _handleCollisionSfx();
    
    const _handleRipple = () => {
      if (this.rippleMesh) {
        if (this.fallingSpeed > 6) {
          this.rippleMesh.visible = true;
          this.rippleGroup.position.copy(this.collisionPosition);
          this.rippleMesh.material.uniforms.vBroken.value = 0.1;
          this.rippleMesh.scale.set(0.2, 1, 0.2);
          this.rippleMesh.material.uniforms.uTime.value = 120;
        }
        let falling = this.fallingSpeed > 10 ? 10 : this.fallingSpeed;
        if (this.rippleMesh.material.uniforms.vBroken.value < 1) {
          if (this.rippleMesh.scale.x > 0.15 * (1 + falling * 0.1)) {
            this.rippleMesh.material.uniforms.vBroken.value *= 1.025;
          }
          this.rippleMesh.scale.x += 0.007 * (1 + falling * 0.1);
          this.rippleMesh.scale.z += 0.007 * (1 + falling * 0.1);
          this.rippleMesh.material.uniforms.uTime.value += 0.015;
        }
        else {
          this.rippleMesh.visible = false;
        }
      }
    };
    _handleRipple();






    this.lastContactWater = this.contactWater;
    this.scene.updateMatrixWorld();
  }

  //########################################################## initialize particle mesh #####################################################
  initRipple() {
    this.rippleGroup = new THREE.Group();
    (async () => {
        const u = `${baseUrl}../assets/textures/water-particle/ripple.glb`;
        const splashMeshApp = await new Promise((accept, reject) => {
          const {gltfLoader} = useLoaders();
          gltfLoader.load(u, accept, function onprogress() {}, reject);
            
        });
        this.rippleGroup.add(splashMeshApp.scene)
        this.rippleMesh = splashMeshApp.scene.children[0];
        this.rippleMesh.visible = false;
        this.scene.add(this.rippleGroup);
        
        this.rippleMesh.material = new THREE.ShaderMaterial({
          uniforms: {
            uTime: {
              value: 0,
            },
            vBroken: {
              value: 0,
            },
            rippleTexture:{
              value: rippleTexture2
            },
            voronoiNoiseTexture:{
              value:voronoiNoiseTexture
            },
            noiseMap:{
              value: noiseMap
            },
          },
          vertexShader: rippleVertex,
          fragmentShader: rippleFragment,
          side: THREE.DoubleSide,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
    })();
  }

}

export default WaterParticleEffect;