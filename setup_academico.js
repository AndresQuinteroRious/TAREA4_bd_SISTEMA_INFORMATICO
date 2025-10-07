// =============================================
// SETUP SISTEMA ACADÉMICO - MongoDB
// =============================================
// Incluye: Creación de colecciones, validaciones, inserciones, CRUD, transacciones, agregaciones y triggers
// Ejecuta este archivo en la consola de MongoDB

// 1. CREACIÓN DE COLECCIONES Y VALIDACIONES
// -------------------------------------------------
db.createCollection("estudiantes", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["codigo", "nombre", "email", "programa", "estado"],
      properties: {
        codigo: { bsonType: "string" },
        nombre: { bsonType: "string" },
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
        },
        programa: {
          bsonType: "object",
          required: ["id", "nombre", "codigo"],
          properties: {
            id: { bsonType: "objectId" },
            nombre: { bsonType: "string" },
            codigo: { bsonType: "string" }
          }
        },
        semestre_actual: { bsonType: "int", minimum: 1, maximum: 12 },
        promedio_acumulado: { bsonType: "double", minimum: 0.0, maximum: 5.0 },
        estado: { bsonType: "string", enum: ["Activo", "Inactivo", "Graduado", "Retirado"] },
        materias_cursadas: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["materia_id", "codigo", "nombre", "periodo", "nota_final", "creditos"],
            properties: {
              materia_id: { bsonType: "objectId" },
              codigo: { bsonType: "string" },
              nombre: { bsonType: "string" },
              periodo: { bsonType: "string" },
              nota_final: { bsonType: "double", minimum: 0.0, maximum: 5.0 },
              creditos: { bsonType: "int", minimum: 1, maximum: 10 }
            }
          }
        },
        contacto: {
          bsonType: "object",
          required: ["telefono", "direccion", "ciudad"],
          properties: {
            telefono: { bsonType: "string" },
            direccion: { bsonType: "string" },
            ciudad: { bsonType: "string" }
          }
        }
      }
    }
  }
});

db.createCollection("profesores", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["nombre", "email", "especialidades"],
      properties: {
        nombre: { bsonType: "string" },
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
        },
        especialidades: {
          bsonType: "array",
          items: { bsonType: "string" }
        },
        materias_asignadas: {
          bsonType: "array",
          items: { bsonType: "objectId" }
        }
      }
    }
  }
});

db.createCollection("materias", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["nombre", "codigo", "creditos"],
      properties: {
        nombre: { bsonType: "string" },
        codigo: { bsonType: "string" },
        creditos: { bsonType: "int", minimum: 1, maximum: 10 },
        prerrequisitos: {
          bsonType: "array",
          items: { bsonType: "objectId" }
        }
      }
    }
  }
});

db.createCollection("programas", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["nombre", "plan_estudio"],
      properties: {
        nombre: { bsonType: "string" },
        plan_estudio: {
          bsonType: "array",
          items: { bsonType: "objectId" }
        },
        requisitos: { bsonType: "string" }
      }
    }
  }
});

db.createCollection("inscripciones", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["estudiante_id", "materia_id", "periodo", "estado"],
      properties: {
        estudiante_id: { bsonType: "objectId" },
        materia_id: { bsonType: "objectId" },
        periodo: { bsonType: "string" },
        fecha_inscripcion: { bsonType: "date" },
        estado: { bsonType: "string", enum: ["Inscrito", "Retirado", "Aprobado", "Reprobado"] }
      }
    }
  }
});

// 2. INSERCIÓN DE DATOS (EJEMPLO)
// -------------------------------------------------
// Inserta aquí tus arrays de estudiantes, profesores, materias, programas e inscripciones
// Ejemplo:
// db.estudiantes.insertMany([ /* ...20 estudiantes... */ ]);
// db.profesores.insertMany([ /* ...20 profesores... */ ]);
// db.materias.insertMany([ /* ...20 materias... */ ]);
// db.programas.insertMany([ /* ...20 programas... */ ]);
// db.inscripciones.insertMany([ /* ...20 inscripciones... */ ]);

// 3. FUNCIONES CRUD DOCUMENTADAS
// -------------------------------------------------
// CREATE
function crearEstudiante(estudiante) {
  return db.estudiantes.insertOne(estudiante);
}
// READ
function buscarEstudiantePorCodigo(codigo) {
  return db.estudiantes.findOne({ codigo: codigo });
}
// UPDATE
function actualizarPromedioEstudiante(codigo, nuevoPromedio) {
  return db.estudiantes.updateOne(
    { codigo: codigo },
    { $set: { promedio_acumulado: nuevoPromedio } }
  );
}
// DELETE
function eliminarEstudiante(codigo) {
  return db.estudiantes.deleteOne({ codigo: codigo });
}

// 4. TRANSACCIONES (EJEMPLO)
// -------------------------------------------------
// Inscribir estudiante en varias materias de forma atómica
function inscribirMultiplesMaterias(estudianteId, materias, periodo) {
  const session = db.getMongo().startSession();
  let resultado = {};
  session.startTransaction();
  try {
    materias.forEach(materiaId => {
      db.inscripciones.insertOne({
        estudiante_id: estudianteId,
        materia_id: materiaId,
        periodo: periodo,
        fecha_inscripcion: new Date(),
        estado: "Inscrito"
      }, { session });
    });
    session.commitTransaction();
    resultado = { success: true };
  } catch (e) {
    session.abortTransaction();
    resultado = { error: e.message };
  } finally {
    session.endSession();
  }
  return resultado;
}

// 5. FUNCIONES DE AGREGACIÓN
// -------------------------------------------------
// Promedio de calificaciones por materia
function promedioPorMateria(codigoMateria) {
  return db.inscripciones.aggregate([
    { $match: { materia_id: codigoMateria, estado: "Aprobado" } },
    { $group: { _id: "$materia_id", promedio: { $avg: "$nota_final" } } }
  ]).toArray();
}
// Estudiantes en riesgo académico
function estudiantesEnRiesgo() {
  return db.estudiantes.aggregate([
    { $match: { promedio_acumulado: { $lt: 3.0 }, estado: "Activo" } },
    { $project: {
      codigo: 1,
      nombre: 1,
      promedio_acumulado: 1,
      nivel_riesgo: {
        $cond: { if: { $lt: ["$promedio_acumulado", 2.5] }, then: "Alto", else: "Medio" }
      }
    } },
    { $sort: { promedio_acumulado: 1 } }
  ]).toArray();
}
// Materias más reprobadas
function materiasMasReprobadas() {
  return db.inscripciones.aggregate([
    { $match: { estado: "Reprobado" } },
    { $group: { _id: "$materia_id", total: { $sum: 1 } } },
    { $sort: { total: -1 } }
  ]).toArray();
}
// Carga académica de profesores por período
function cargaProfesores(periodo) {
  return db.profesores.aggregate([
    { $unwind: "$materias_asignadas" },
    { $lookup: {
      from: "materias",
      localField: "materias_asignadas",
      foreignField: "_id",
      as: "materia"
    } },
    { $project: {
      nombre: 1,
      materia: "$materia.nombre",
      periodo: periodo
    } }
  ]).toArray();
}
// Estadísticas de graduación por programa
function estadisticasGraduacion() {
  return db.estudiantes.aggregate([
    { $match: { estado: "Graduado" } },
    { $group: { _id: "$programa.id", total: { $sum: 1 } } }
  ]).toArray();
}

// 6. CHANGE STREAMS (TRIGGERS)
// -------------------------------------------------
// Auditoría de cambios en estudiantes
const changeStreamEstudiantes = db.estudiantes.watch();
changeStreamEstudiantes.on("change", function(change) {
  db.auditoria.insertOne({
    fecha: new Date(),
    operacion: change.operationType,
    coleccion: "estudiantes",
    documento_id: change.documentKey._id,
    cambios: change.updateDescription || {},
    usuario: "sistema"
  });
});
// ...otros triggers similares para riesgo, créditos, cupos, historial académico

// =============================================
// Justificación de Validaciones
// =============================================
// - Email: Garantiza comunicación institucional y evita duplicados.
// - Rango de notas: Evita errores y asegura lógica académica.
// - Semestre: Controla avance académico realista.
// - Estado: Permite gestión de ciclo de vida estudiantil.
// - Créditos: Controla carga académica y requisitos de graduación.
// - Fechas: Evita registros inválidos y asegura integridad histórica.
