import * as THREE from 'three';

/** Visible, narrow searchlight beams. No ambient/directional fill can brighten the town. */
export function createStadiumSkyLights(){
 const root=new THREE.Group();root.name='Stadium_Sky_Searchlights';
 const beamGeometry=new THREE.CylinderGeometry(4.4,.13,1,24,1,true);beamGeometry.translate(0,.5,0);
 const bodyGeometry=new THREE.CylinderGeometry(.6,.8,1.4,16),lensGeometry=new THREE.SphereGeometry(.34,12,8);
 const bodyMaterial=new THREE.MeshStandardMaterial({color:'#172a3e',metalness:.7,roughness:.3}),lensMaterial=new THREE.MeshBasicMaterial({color:'#d6f7ff',toneMapped:false});
 const beamMaterial=new THREE.ShaderMaterial({uniforms:{color:{value:new THREE.Color('#a1dfff')},strength:{value:.17}},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false,
  vertexShader:'varying vec2 vUv; varying vec3 vNormal; varying vec3 vView; void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.0);vNormal=normalMatrix*normal;vView=-p.xyz;gl_Position=projectionMatrix*p;}',
  fragmentShader:'uniform vec3 color;uniform float strength;varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;void main(){float edge=pow(abs(dot(normalize(vNormal),normalize(vView))),1.25);float fade=pow(1.0-vUv.y,1.2);gl_FragColor=vec4(color,strength*edge*fade);}'
 });
 const fixtures:Array<{pivot:THREE.Group;beam:THREE.Mesh;index:number}>=[];
 for(let i=0;i<4;i++){
  const a=Math.PI/4+i*Math.PI/2,x=68*Math.sin(a),z=68*Math.cos(a),pivot=new THREE.Group();pivot.name='Stadium_Sky_Fixture_'+i;pivot.position.set(x,37,z);root.add(pivot);
  const body=new THREE.Mesh(bodyGeometry,bodyMaterial);body.position.y=.2;pivot.add(body);const lens=new THREE.Mesh(lensGeometry,lensMaterial);lens.position.y=1;pivot.add(lens);
  const beam=new THREE.Mesh(beamGeometry,beamMaterial);beam.name='Stadium_Sky_Beam_'+i;beam.raycast=()=>{};beam.position.y=1;
  // Box3 honors object bounds before geometry bounds. Light has no solid volume:
  // exclude only the beam from the stadium's exterior collision/focus envelope.
  Object.assign(beam,{boundingBox:new THREE.Box3()});pivot.add(beam);
  // Empty sky has no surface to light. The volumetric mesh supplies the beam
  // without four extra PBR light evaluations on every seat and building pixel.
  fixtures.push({pivot,beam,index:i});
 }
 const up=new THREE.Vector3(0,1,0),direction=new THREE.Vector3(),target=new THREE.Vector3();
 const update=(time:number)=>{for(const f of fixtures){
  // A slow coordinated circle, gathering close to the center every 20 seconds.
  const phase=time*.22+f.index*Math.PI/2,radius=2+10*(.5+.5*Math.sin(time*.15));target.set(Math.cos(phase)*radius,112+4*Math.sin(time*.18),Math.sin(phase)*radius);
  direction.copy(target).sub(f.pivot.position);const length=direction.length();f.pivot.quaternion.setFromUnitVectors(up,direction.normalize());f.beam.scale.y=length;f.pivot.userData.aim=target.toArray();
 }};
 update(0);
 return{root,update,dispose:()=>{root.removeFromParent();beamGeometry.dispose();bodyGeometry.dispose();lensGeometry.dispose();bodyMaterial.dispose();lensMaterial.dispose();beamMaterial.dispose();}};
}
