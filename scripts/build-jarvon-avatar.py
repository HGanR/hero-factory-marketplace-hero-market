"""Deterministic, rigged Jarvon prototype. No downloaded/licensed human asset.
Blender 4.3: blender -b --python scripts/build-jarvon-avatar.py -- OUTPUT.glb
Stylized 3D prototype; portrait likeness refinement remains an art task.
"""
import bpy, math, random, sys
from mathutils import Vector
random.seed(28)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,color,metal=.0,rough=.5,emit=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes.get('Principled BSDF');n.inputs['Base Color'].default_value=(*color,1);n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough
 if emit:n.inputs['Emission Color'].default_value=(*color,1);n.inputs['Emission Strength'].default_value=emit
 return m
skin=mat('Brown skin',(.28,.105,.055),.05,.5);suit=mat('Midnight holographic suit',(.008,.025,.095),.2,.34);hair=mat('Textured dark curls',(.009,.006,.014),.02,.8);cyan=mat('Cyan neural light',(.0,.55,1),.15,.3,2);violet=mat('Violet neural nodes',(.42,.025,1),.15,.3,2);white=mat('Blue white shirt',(.15,.5,.7),.05,.35,.1);black=mat('Dress shoe leather',(.008,.014,.03),.2,.3);eye=mat('Luminous cyan iris',(.015,.65,1),.0,.2,2)
objects=[]
def finish(o,name,material,bone):
 o.name=name;o.data.materials.append(material);objects.append((o,bone));return o
def ell(name,pos,size,m,bone,segments=16,rings=10):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=pos);o=bpy.context.object;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for p in o.data.polygons:p.use_smooth=True
 return finish(o,name,m,bone)
def box(name,pos,size,m,bone,bevel=.01):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:mod=o.modifiers.new('Tailored edges','BEVEL');mod.width=bevel;mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return finish(o,name,m,bone)
def link(name,a,b,r,m,bone):
 d=Vector(b)-Vector(a);mid=(Vector(a)+Vector(b))/2;bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=r,depth=d.length,location=mid);o=bpy.context.object;o.rotation_mode='QUATERNION';o.rotation_quaternion=d.to_track_quat('Z','Y')
 for p in o.data.polygons:p.use_smooth=True
 return finish(o,name,m,bone)
# Body fronts toward -Y; GLTF export converts Blender Z-up to Y-up.
ell('Jacket torso',(0,0,1.25),(.235,.115,.32),suit,'Chest',24,16);ell('Waist',(0,0,1.03),(.185,.105,.16),suit,'Hips')
box('Shirt',(0,-.108,1.37),(.20,.025,.24),white,'Chest',.01)
for side in [-1,1]:
 o=box('Lapel',(side*.11,-.125,1.35),(.065,.025,.27),suit,'Chest');o.rotation_euler.y=side*-.3
link('Neck',(0,0,1.46),(0,0,1.60),.066,skin,'Neck')
box('Holographic tie',(0,-.143,1.34),(.032,.012,.23),cyan,'Chest',.003)
# Sculpted form built from deliberate facial parts, not an image reconstruction mesh.
ell('Head',(0,0,1.69),(.107,.096,.145),skin,'Head',24,20)
ell('Jaw',(0,-.012,1.615),(.083,.081,.063),skin,'Head',20,12)
ell('Nose',(0,-.100,1.687),(.023,.038,.035),skin,'Head')
for side in [-1,1]:
 ell('Ear',(side*.105,0,1.687),(.021,.021,.038),skin,'Head')
 ell('Eye socket',(side*.041,-.082,1.721),(.032,.017,.015),black,'Head')
 ell('Iris',(side*.041,-.098,1.721),(.012,.004,.011),eye,'Head')
 o=box('Eyebrow',(side*.04,-.094,1.744),(.052,.01,.009),hair,'Head',.003);o.rotation_euler.y=side*.1
ell('Lower lip',(0,-.091,1.642),(.030,.009,.008),skin,'Head')
ell('Beard chin',(0,-.044,1.595),(.066,.055,.025),hair,'Head')
for side in [-1,1]:link('Beard jaw',(side*.068,-.050,1.63),(side*.040,-.071,1.60),.012,hair,'Head')
for i in range(105):
 a=random.random()*math.tau;r=math.sqrt(random.random());x=.101*r*math.cos(a);y=.089*r*math.sin(a);z=1.77+.058*math.sqrt(max(0,1-r*r))
 ell('Curl',(x,y,z),(.014,.014,.017),hair,'Head',8,6)
 if i%9==0:ell('Hair light',(x,y,z+.007),(.004,.004,.005),cyan,'Head',6,4)
for side,label in [(-1,'L'),(1,'R')]:
 shoulder=(side*.23,0,1.43);elbow=(side*.32,0,1.16);wrist=(side*.35,-.012,.94)
 ell('Sleeve upper',tuple((Vector(shoulder)+Vector(elbow))/2),(.079,.077,.17),suit,'UpperArm.'+label)
 ell('Sleeve lower',tuple((Vector(elbow)+Vector(wrist))/2),(.061,.063,.145),suit,'Forearm.'+label)
 ell('Cuff',wrist,(.059,.060,.024),white,'Hand.'+label)
 ell('Hand',(side*.35,-.01,.871),(.048,.027,.072),skin,'Hand.'+label)
 for j in range(4):link('Finger',(side*.35+(j-1.5)*.022,-.012,.842),(side*.35+(j-1.5)*.022,-.018,.782+(abs(j-1.5)*.01)),.008,skin,'Hand.'+label)
 link('Thumb',(side*.31,-.02,.89),(side*.29,-.035,.84),.012,skin,'Hand.'+label)
 hip=(side*.108,0,1);knee=(side*.115,-.005,.57);ankle=(side*.115,0,.12)
 ell('Trouser thigh',tuple((Vector(hip)+Vector(knee))/2),(.104,.10,.25),suit,'Thigh.'+label)
 ell('Trouser shin',tuple((Vector(knee)+Vector(ankle))/2),(.081,.08,.25),suit,'Shin.'+label)
 ell('Dress shoe',(side*.115,-.065,.064),(.087,.155,.061),black,'Foot.'+label)
 # Emissive seam work follows the bones and remains crisp during walking.
 for a,b,bone in [(shoulder,elbow,'UpperArm.'+label),(elbow,wrist,'Forearm.'+label),(hip,knee,'Thigh.'+label),(knee,ankle,'Shin.'+label)]:
  av,bv=Vector(a),Vector(b);av.y-=.075;bv.y-=.075;link('Cyan contour',av,bv,.003,cyan,bone)
# Neural constellation lines distributed over tailored surfaces. Low-cost geometry, no particle simulator.
for i in range(80):
 z=random.uniform(1.05,1.48);w=.17 if z<1.2 else .21;x=random.uniform(-w,w);a=(x,-.115,z);b=(max(-.21,min(.21,x+random.uniform(-.08,.08))),-.12,z+random.uniform(-.07,.07))
 link('Neural filament',a,b,.0016,cyan if i%3 else violet,'Chest')
 if i%3==0:ell('Neural node',a,(.005,.005,.005),cyan if i%2 else violet,'Chest',6,4)
# One genuine deforming armature; every wearable part has explicit weights.
bpy.ops.object.armature_add(enter_editmode=True);rig=bpy.context.object;rig.name='JarvonRig';arm=rig.data;arm.edit_bones.remove(arm.edit_bones[0])
bones={}
def bone(name,head,tail,parent=None):
 b=arm.edit_bones.new(name);b.head=head;b.tail=tail
 if parent:b.parent=bones[parent]
 bones[name]=b
bone('Hips',(0,0,.95),(0,0,1.10));bone('Spine',(0,0,1.1),(0,0,1.28),'Hips');bone('Chest',(0,0,1.28),(0,0,1.48),'Spine');bone('Neck',(0,0,1.48),(0,0,1.57),'Chest');bone('Head',(0,0,1.57),(0,0,1.83),'Neck')
for side,label in [(-1,'L'),(1,'R')]:
 bone('UpperArm.'+label,(side*.23,0,1.43),(side*.32,0,1.16),'Chest');bone('Forearm.'+label,(side*.32,0,1.16),(side*.35,0,.94),'UpperArm.'+label);bone('Hand.'+label,(side*.35,0,.94),(side*.35,0,.80),'Forearm.'+label)
 bone('Thigh.'+label,(side*.108,0,.95),(side*.115,0,.57),'Hips');bone('Shin.'+label,(side*.115,0,.57),(side*.115,0,.12),'Thigh.'+label);bone('Foot.'+label,(side*.115,0,.12),(side*.115,-.15,.06),'Shin.'+label)
bpy.ops.object.mode_set(mode='OBJECT')
for o,bn in objects:
 group=o.vertex_groups.new(name=bn);group.add(list(range(len(o.data.vertices))),1,'REPLACE');mod=o.modifiers.new('Jarvon skeleton','ARMATURE');mod.object=rig;o.parent=rig
# Join mesh parts by material; bone weights are preserved, minimizing draw calls.
for material in [skin,suit,hair,cyan,violet,white,black,eye]:
 parts=[o for o in bpy.data.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==material]
 if not parts:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();bpy.context.object.name='Jarvon_'+material.name.replace(' ','_')
rig.animation_data_create()
for name in ['Idle','Walk','Seated']:
 action=bpy.data.actions.new(name);rig.animation_data.action=action
 for frame in range(0,31,5):
  phase=frame/30*math.tau
  for p in rig.pose.bones:p.rotation_mode='XYZ';p.rotation_euler=(0,0,0);p.location=(0,0,0)
  if name=='Walk':
   for label,offset in [('L',0),('R',math.pi)]:
    step=math.sin(phase+offset);rig.pose.bones['Thigh.'+label].rotation_euler.x=step*.48;rig.pose.bones['Shin.'+label].rotation_euler.x=max(0,-step)*.55;rig.pose.bones['UpperArm.'+label].rotation_euler.x=-step*.3;rig.pose.bones['Forearm.'+label].rotation_euler.x=-.12
   rig.pose.bones['Hips'].location.y=abs(math.sin(phase))*.018
  elif name=='Seated':
   rig.pose.bones['Hips'].location.y=-.46
   for label in ['L','R']:rig.pose.bones['Thigh.'+label].rotation_euler.x=-math.pi/2;rig.pose.bones['Shin.'+label].rotation_euler.x=math.pi/2;rig.pose.bones['Forearm.'+label].rotation_euler.x=-.3
  else:rig.pose.bones['Chest'].rotation_euler.x=math.sin(phase)*.012
  for p in rig.pose.bones:p.keyframe_insert('rotation_euler',frame=frame,group=p.name);p.keyframe_insert('location',frame=frame,group=p.name)
 track=rig.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);rig.animation_data.action=None
 for p in rig.pose.bones:p.rotation_euler=(0,0,0);p.location=(0,0,0)
bpy.context.scene.frame_set(0);bpy.context.scene.render.fps=30
output=sys.argv[sys.argv.index('--')+1]
bpy.ops.export_scene.gltf(filepath=output,export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_yup=True)
print('JARVON_AVATAR_EXPORTED',output)
