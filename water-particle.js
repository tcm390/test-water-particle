import metaversefile from 'metaversefile';
import * as THREE from 'three';
import loadTexture from './loadTexture.js';
import {
  rippleVertex,
  rippleFragment,
  lowerSplashVertex, 
  lowerSplashFragment
} from './water-shader.js';

const {useLoaders, useSound, useInternals} = metaversefile;
const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');
const sounds = useSound();
const soundFiles = sounds.getSoundFiles();

const voronoiNoiseTexture = loadTexture(`../assets/textures/water-particle/textures/voronoiNoise.jpg`);
const noiseMap = loadTexture(`../assets/textures/water-particle/textures/noise.jpg`);
const rippleTexture2 = loadTexture(`../assets/textures/water-particle/textures/ripple2.png`);
const splashTexture2 = loadTexture(`../assets/textures/water-particle/textures/splash2.png`, false);

class WaterParticleEffect {
  constructor() {
    this.scene = useInternals().sceneLowPriority;
    this.camera = useInternals().camera;
    this.contactWater = false;
    this.contactWater = false;
    this.player = null;
    this.waterSurfaceHeight = 0;

    this.lastContactWater = false;

    this.collisionPosition = new THREE.Vector3();

    this.fallingSpeed = null;
    
    this.rippleMesh = null;
    this.initRipple();

    this.lowerSplash = null;
    this.initLowerSplash();
  }
  
  update() {
    const timestamp = performance.now();
    
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
          this.rippleMesh.scale.set(0.25, 1, 0.25);
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

    const _handleLowerSplash = () =>{
      if (this.lowerSplash) { 
        const brokenAttribute = this.lowerSplash.geometry.getAttribute('broken');
        const positionsAttribute = this.lowerSplash.geometry.getAttribute('positions');
        const scalesAttribute = this.lowerSplash.geometry.getAttribute('scales');
        const textureRotationAttribute = this.lowerSplash.geometry.getAttribute('textureRotation');
        const particleCount = this.lowerSplash.info.particleCount;
        for (let i = 0; i < particleCount; i++) {
          if (this.fallingSpeed > 6) {
            this.lowerSplash.info.velocity[i].x = Math.sin(i) * .055 + (Math.random() - 0.5) * 0.001;
            this.lowerSplash.info.velocity[i].y = 0.12 + 0.01 * Math.random();
            this.lowerSplash.info.velocity[i].z = Math.cos(i) * .055 + (Math.random() - 0.5) * 0.001;
            positionsAttribute.setXYZ(  i, 
                                        this.collisionPosition.x + this.lowerSplash.info.velocity[i].x,
                                        this.collisionPosition.y + 0.1 * Math.random(),
                                        this.collisionPosition.z + this.lowerSplash.info.velocity[i].z
            );
            this.lowerSplash.info.velocity[i].divideScalar(5);
            scalesAttribute.setX(i, 0.6);
            textureRotationAttribute.setX(i, Math.random() * 2);
            brokenAttribute.setX(i, 0.2); 
            if (this.higherSplashSw === 2) {
              this.higherSplashSw = 0;
              this.higherSplashPos.copy(this.collisionPosition);
            }
          }
            
          if (scalesAttribute.getX(i) >= 0.6 && scalesAttribute.getX(i) < 2.1) {
            scalesAttribute.setX(i, scalesAttribute.getX(i) + 0.2);
          }
          if (scalesAttribute.getX(i) >= 2.1) {
            if (brokenAttribute.getX(i) < 1) {
              brokenAttribute.setX(i, brokenAttribute.getX(i) + 0.015);
              positionsAttribute.setXYZ(  i, 
                                          positionsAttribute.getX(i) + this.lowerSplash.info.velocity[i].x,
                                          positionsAttribute.getY(i) + this.lowerSplash.info.velocity[i].y,
                                          positionsAttribute.getZ(i) + this.lowerSplash.info.velocity[i].z
              );
              this.lowerSplash.info.velocity[i].add(this.lowerSplash.info.acc);
              if (this.higherSplashSw === 0) {
                this.higherSplashSw = 1;
              }
            }
          }
        }
        brokenAttribute.needsUpdate = true;
        positionsAttribute.needsUpdate = true;
        scalesAttribute.needsUpdate = true;
        textureRotationAttribute.needsUpdate = true;
        this.lowerSplash.material.uniforms.uTime.value = timestamp / 1000;
        this.lowerSplash.material.uniforms.cameraBillboardQuaternion.value.copy(this.camera.quaternion);
        this.lowerSplash.material.uniforms.waterSurfacePos.value = this.waterSurfaceHeight;
      }
    }
    _handleLowerSplash();






    this.lastContactWater = this.contactWater;
    this.scene.updateMatrixWorld();
  }

  //########################################################## initialize particle mesh #####################################################
  _getGeometry = (geometry, attributeSpecs, particleCount) => {
    const geometry2 = new THREE.BufferGeometry();
    ['position', 'normal', 'uv'].forEach(k => {
      geometry2.setAttribute(k, geometry.attributes[k]);
    });
    geometry2.setIndex(geometry.index);
    
    const positions = new Float32Array(particleCount * 3);
    const positionsAttribute = new THREE.InstancedBufferAttribute(positions, 3);
    geometry2.setAttribute('positions', positionsAttribute);

    for(const attributeSpec of attributeSpecs){
        const {
            name,
            itemSize,
        } = attributeSpec;
        const array = new Float32Array(particleCount * itemSize);
        geometry2.setAttribute(name, new THREE.InstancedBufferAttribute(array, itemSize));
    }

    return geometry2;
  };
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
  initLowerSplash(){
    const particleCount = 15;
    const attributeSpecs = [];
    attributeSpecs.push({name: 'broken', itemSize: 1});
    attributeSpecs.push({name: 'scales', itemSize: 1});
    attributeSpecs.push({name: 'textureRotation', itemSize: 1});
    const geometry2 = new THREE.PlaneGeometry(0.2, 0.2);
    const geometry = this._getGeometry(geometry2, attributeSpecs, particleCount);
    const material= new THREE.ShaderMaterial({
      uniforms: {
          uTime: {
            value: 0,
          },
          cameraBillboardQuaternion: {
            value: new THREE.Quaternion(),
          },
          splashTexture: {
            value: splashTexture2,
          },
          waterSurfacePos: {
            value: 0,
          },
          noiseMap:{
            value: noiseMap
          },
      },
      vertexShader: lowerSplashVertex,
      fragmentShader: lowerSplashFragment,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
    this.lowerSplash = new THREE.InstancedMesh(geometry, material, particleCount);
    this.lowerSplash.info = {
        particleCount: particleCount,
        velocity: [particleCount],
        acc: new THREE.Vector3(0, -0.002, 0)
    }
    for(let i = 0; i < particleCount; i++){
        this.lowerSplash.info.velocity[i] = new THREE.Vector3();
    }
    this.scene.add(this.lowerSplash);
  }

}

export default WaterParticleEffect;