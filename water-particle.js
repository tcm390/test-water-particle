import metaversefile from 'metaversefile';
import * as THREE from 'three';
import loadTexture from './loadTexture.js';
import {
  rippleVertex, rippleFragment,
  divingLowerSplashVertex, divingLowerSplashFragment,
  divingHigherSplashVertex, divingHigherSplashFragment,
} from './water-shader.js';

const {useLoaders, useSound, useInternals} = metaversefile;
const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');
const sounds = useSound();
const soundFiles = sounds.getSoundFiles();

const voronoiNoiseTexture = loadTexture(`../assets/textures/water-particle/textures/voronoiNoise.jpg`);
const noiseMap = loadTexture(`../assets/textures/water-particle/textures/noise.jpg`);
const rippleTexture2 = loadTexture(`../assets/textures/water-particle/textures/ripple2.png`);
const splashTexture2 = loadTexture(`../assets/textures/water-particle/textures/splash2.png`, false);
const splashTexture3 = loadTexture(`../assets/textures/water-particle/textures/splash3.png`, false);

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

    this.divingLowerSplash = null;
    this.initDivingLowerSplash();

    this.divingHigherSplash = null;
    this.initDivingHigherSplash();
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

    const _handledivingLowerSplash = () =>{
      if (this.divingLowerSplash) { 
        const brokenAttribute = this.divingLowerSplash.geometry.getAttribute('broken');
        const positionsAttribute = this.divingLowerSplash.geometry.getAttribute('positions');
        const scalesAttribute = this.divingLowerSplash.geometry.getAttribute('scales');
        const textureRotationAttribute = this.divingLowerSplash.geometry.getAttribute('textureRotation');
        const particleCount = this.divingLowerSplash.info.particleCount;
        for (let i = 0; i < particleCount; i++) {
          if (this.fallingSpeed > 6) {
            this.divingLowerSplash.info.velocity[i].x = Math.sin(i) * .055 + (Math.random() - 0.5) * 0.001;
            this.divingLowerSplash.info.velocity[i].y = 0.12 + 0.01 * Math.random();
            this.divingLowerSplash.info.velocity[i].z = Math.cos(i) * .055 + (Math.random() - 0.5) * 0.001;
            positionsAttribute.setXYZ(  
              i, 
              this.collisionPosition.x + this.divingLowerSplash.info.velocity[i].x,
              this.collisionPosition.y + 0.1 * Math.random(),
              this.collisionPosition.z + this.divingLowerSplash.info.velocity[i].z
            );
            this.divingLowerSplash.info.velocity[i].divideScalar(5);
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
              positionsAttribute.setXYZ(  
                i, 
                positionsAttribute.getX(i) + this.divingLowerSplash.info.velocity[i].x,
                positionsAttribute.getY(i) + this.divingLowerSplash.info.velocity[i].y,
                positionsAttribute.getZ(i) + this.divingLowerSplash.info.velocity[i].z
              );
              this.divingLowerSplash.info.velocity[i].add(this.divingLowerSplash.info.acc);
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
        this.divingLowerSplash.material.uniforms.cameraBillboardQuaternion.value.copy(this.camera.quaternion);
        this.divingLowerSplash.material.uniforms.waterSurfacePos.value = this.waterSurfaceHeight;
      }
    }
    _handledivingLowerSplash();

    const _handledivingHigherSplash = () =>{
      if (this.divingHigherSplash) { 
        const brokenAttribute = this.divingHigherSplash.geometry.getAttribute('broken');
        const positionsAttribute = this.divingHigherSplash.geometry.getAttribute('positions');
        const scalesAttribute = this.divingHigherSplash.geometry.getAttribute('scales');
        const rotationAttribute = this.divingHigherSplash.geometry.getAttribute('rotation');
        const particleCount = this.divingHigherSplash.info.particleCount;
        if (this.fallingSpeed > 6) {
          for (let i = 0; i < particleCount; i++) {
            this.divingHigherSplash.info.velocity[i].y = (0.12 + 0.01 * Math.random()) * 0.8;
            brokenAttribute.setX(i, 0.2 + Math.random() * 0.25);
            scalesAttribute.setX(i, 0.5 + Math.random() * 0.5);
            const theta = 2. * Math.PI * i / particleCount;
            positionsAttribute.setXYZ(
              i,
              this.collisionPosition.x + Math.sin(theta) * 0.1,
              this.collisionPosition.y - 0.5,
              this.collisionPosition.z + Math.cos(theta) * 0.1
            ) 
            const n = Math.cos(theta) > 0 ? 1 : -1;
            rotationAttribute.setXYZ(i, -Math.sin(theta) * n * (Math.PI / 2)); 
          }
        }
        for (let i = 0; i < particleCount; i++) {
          if (brokenAttribute.getX(i) < 1) {
            brokenAttribute.setX(i, brokenAttribute.getX(i) * 1.02);
          }
          scalesAttribute.setX(i, scalesAttribute.getX(i) + 0.02);
          positionsAttribute.setY(i, positionsAttribute.getY(i) + this.divingHigherSplash.info.velocity[i].y);
          this.divingHigherSplash.info.velocity[i].add(this.divingHigherSplash.info.acc); 
        }
        brokenAttribute.needsUpdate = true;
        positionsAttribute.needsUpdate = true;
        scalesAttribute.needsUpdate = true;
        rotationAttribute.needsUpdate = true;
        this.divingHigherSplash.material.uniforms.waterSurfacePos.value = this.waterSurfaceHeight;
      }
    }
    _handledivingHigherSplash();






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
  initDivingLowerSplash(){
    const particleCount = 15;
    const attributeSpecs = [];
    attributeSpecs.push({name: 'broken', itemSize: 1});
    attributeSpecs.push({name: 'scales', itemSize: 1});
    attributeSpecs.push({name: 'textureRotation', itemSize: 1});
    const geometry2 = new THREE.PlaneGeometry(0.2, 0.25);
    const geometry = this._getGeometry(geometry2, attributeSpecs, particleCount);
    const material= new THREE.ShaderMaterial({
      uniforms: {
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
      vertexShader: divingLowerSplashVertex,
      fragmentShader: divingLowerSplashFragment,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
    this.divingLowerSplash = new THREE.InstancedMesh(geometry, material, particleCount);
    this.divingLowerSplash.info = {
      particleCount: particleCount,
      velocity: [particleCount],
      acc: new THREE.Vector3(0, -0.002, 0)
    }
    for (let i = 0; i < particleCount; i++) {
      this.divingLowerSplash.info.velocity[i] = new THREE.Vector3();
    }
    this.scene.add(this.divingLowerSplash);
  }
  initDivingHigherSplash(){
    const particleCount = 15;
    const attributeSpecs = [];
    attributeSpecs.push({name: 'broken', itemSize: 1});
    attributeSpecs.push({name: 'scales', itemSize: 1});
    attributeSpecs.push({name: 'rotation', itemSize: 1});
    const geometry2 = new THREE.PlaneGeometry(0.25, 1);
    const geometry = this._getGeometry(geometry2, attributeSpecs, particleCount);
    const material= new THREE.ShaderMaterial({
      uniforms: {
        splashTexture: {
          value: splashTexture3,
        },
        waterSurfacePos: {
          value: 0,
        },
        noiseMap:{
          value: noiseMap
        },
      },
      vertexShader: divingHigherSplashVertex,
      fragmentShader: divingHigherSplashFragment,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
    this.divingHigherSplash = new THREE.InstancedMesh(geometry, material, particleCount);
    this.divingHigherSplash.info = {
      particleCount: particleCount,
      velocity: [particleCount],
      acc: new THREE.Vector3(0, -0.004, 0)
    }
    for (let i = 0; i < particleCount; i++) {
      this.divingHigherSplash.info.velocity[i] = new THREE.Vector3();
    }
    this.scene.add(this.divingHigherSplash);
  }
  

}

export default WaterParticleEffect;