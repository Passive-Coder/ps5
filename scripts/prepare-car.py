"""Prepare the licensed Caliburn locally; raw model files stay in .cache.

Run with Blender's actual executable (not a symlink):
Blender --background --factory-startup --disable-autoexec .cache/caliburn/source.blend --python scripts/prepare-car.py
"""
import bpy
import json
from pathlib import Path
from mathutils import Vector

# Reference livery, applied to the model's separate manufactured panels.
PEARL = {'Plane', 'Plane.002', 'Plane.003', 'Plane.004', 'Plane.005', 'Plane.010'}
GLASS = {'Plane.008', 'Plane.015'}
GOLD = {'Plane.026', 'Plane.040', 'Plane.045'}
BLACK = {'Plane.007', 'Plane.012', 'Plane.013', 'Plane.016', 'Plane.018'}
PAINT = {'Plane.011', 'Plane.017', 'Plane.021', 'Plane.022', 'Plane.023', 'Plane.025', 'Plane.027', 'Plane.028', 'Plane.093'}
SURFACES = {
 'car-paint': ['#066a79', .62, .22],
 'car-pearl': ['#d7dcd3', .38, .23],
 'car-gold': ['#bd932f', .65, .28],
 'car-glass': ['#111f23', .55, .12],
 'car-carbon': ['#172124', .48, .44],
 'car-rubber': ['#151919', .03, .84],
 'car-alloy': ['#837c64', .86, .24],
 'car-grille': ['#1b2426', .68, .49],
 'car-taillight': ['#c72d35', .12, .2],
 'car-headlight': ['#c8d9df', .12, .2],
 'car-indicator': ['#bc6826', .3, .3],
}

def surface(obj, original):
 n=original.lower()
 if 'tail light' in n:return 'car-taillight'
 if 'front emission' in n:return 'car-headlight'
 if 'turnlight' in n:return 'car-indicator'
 if obj.name.startswith('Cube'):
  return 'car-rubber' if 'rubber' in n else 'car-alloy' if n in ['body 2','steel'] else 'car-grille'
 if obj.name in GLASS:return 'car-glass'
 if 'glass' in n:return 'car-carbon'
 if obj.name in PEARL:return 'car-pearl'
 if obj.name in GOLD:return 'car-gold'
 if obj.name in BLACK:return 'car-carbon'
 if obj.name in PAINT:return 'car-paint'
 if 'black' in n or 'carbon fiber'==n or 'jet' in n:return 'car-grille'
 if 'copper' in n:return 'car-grille'
 return 'car-paint'

scale=4.8/5.005699
# Original vehicle faces -Y, with Z up. Runtime vehicle faces -Z, with Y up.
def convert(v):return [(v.x+.0153534)*scale, (v.z+.00057265)*scale, (v.y+.0136235)*scale]
parts=[]
for obj in list(bpy.context.scene.objects):
 if obj.type!='MESH':continue
 # Nested wire lattices have multiple overlapping density layers in the source.
 # Keep the visible coarse lattice and reserve the budget for the body silhouette.
 if obj.name in {'Plane.087','Plane.086','Plane.080','Plane.076','Plane.074','Plane.072','Plane.069','Plane.038','Plane.035'}:continue
 wire=any(m.type=='WIREFRAME' for m in obj.modifiers)
 for mod in obj.modifiers:
  if mod.type=='SUBSURF':mod.levels=0 if wire else min(mod.levels,1);mod.render_levels=mod.levels
 dg=bpy.context.evaluated_depsgraph_get();ev=obj.evaluated_get(dg)
 editable=bpy.data.meshes.new_from_object(ev)
 temp=bpy.data.objects.new('preparation',editable);bpy.context.scene.collection.objects.link(temp)
 tri_count=sum(len(p.vertices)-2 for p in editable.polygons)
 budget=18000 if obj.name.startswith('Cube') else 5000
 if tri_count>budget:
  decimate=temp.modifiers.new('Runtime budget','DECIMATE');decimate.ratio=budget/tri_count
 bpy.context.view_layer.update()
 prepared=temp.evaluated_get(bpy.context.evaluated_depsgraph_get())
 me=prepared.to_mesh();me.calc_loop_triangles()
 normals=[n.vector.copy() for n in me.corner_normals]
 uvs=[v.uv.copy() for v in me.uv_layers.active.data] if me.uv_layers.active else None
 matnames=[surface(obj,m.name if m else '') for m in obj.data.materials]
 sections={}
 normal_matrix=obj.matrix_world.to_3x3().inverted().transposed()
 for tri in me.loop_triangles:
  world=[obj.matrix_world@me.vertices[i].co for i in tri.vertices]
  wheel=None
  if obj.name.startswith('Cube'):
   side='right' if sum(v.x for v in world)>0 else 'left'
   axle='front' if obj.name=='Cube' else 'rear'
   wheel=f'wheel-{axle}-{side}'
  mat=matnames[tri.material_index] if matnames else 'car-grille'
  key=(wheel,mat)
  if key not in sections:sections[key]={'p':[],'n':[],'uv':[]}
  out=sections[key]
  for vi,li in reversed(list(zip(tri.vertices,tri.loops))):
   v=convert(obj.matrix_world@me.vertices[vi].co)
   if wheel:
    center=[(1.07 if side=='right' else -1.07)*scale, (.37212 if axle=='front' else .3903)*scale, (-1.57404 if axle=='front' else 1.6235)*scale]
    v=[v[i]-center[i] for i in range(3)]
   n=normal_matrix@normals[li];n.normalize()
   out['p'].extend(round(c,6) for c in v)
   out['n'].extend(round(c,5) for c in [n.x,n.z,n.y])
   uv=uvs[li] if uvs else (0,0)
   out['uv'].extend(round(c,5) for c in uv)
 for (wheel,mat),attributes in sections.items():
  parts.append({'name':obj.name,'wheel':wheel,'surface':mat,**attributes})
 prepared.to_mesh_clear();bpy.data.objects.remove(temp,do_unlink=True);bpy.data.meshes.remove(editable)
Path('.cache/caliburn').mkdir(parents=True,exist_ok=True)
Path('.cache/caliburn/car.json').write_text(json.dumps({'surfaces':SURFACES,'parts':parts,'scale':scale},separators=(',',':')))
print('Prepared Caliburn:',len(parts),'surfaces,',sum(len(p['p'])//9 for p in parts),'triangles')
